package com.motoxplus.api.marketplace;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.motoxplus.api.IntegrationTestBase;
import com.motoxplus.api.marketplace.audit.AuditLogService;
import com.motoxplus.api.marketplace.idempotency.IdempotencyService;
import com.motoxplus.api.marketplace.idempotency.IdempotencyService.StoredResponse;
import com.motoxplus.api.marketplace.iam.PermissionService;
import com.motoxplus.api.marketplace.outbox.OutboxService;
import com.motoxplus.api.security.AuthenticatedUser;
import com.motoxplus.api.security.JwtService;
import com.motoxplus.api.security.JwtService.AccessClaims;
import com.motoxplus.api.web.ApiException;
import java.time.Duration;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataAccessException;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.IllegalTransactionStateException;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/** Phase 1 foundation against a real (throwaway) PostgreSQL with Flyway applied to schema "marketplace". */
class MarketplaceFoundationIntegrationTest extends IntegrationTestBase {

    @DynamicPropertySource
    static void marketplaceOn(DynamicPropertyRegistry r) {
        r.add("marketplace.enabled", () -> "true");
        r.add("app.db.migrate", () -> "true");
        // The shared test DB is built from the generated Prisma schema (no _prisma_migrations table), so the
        // guard is switched off here and exercised on its own in BaselineGuardTest.
        r.add("app.db.baseline-guard", () -> "false");
    }

    @Autowired JwtService jwt;
    @Autowired PermissionService perm;
    @Autowired AuditLogService audit;
    @Autowired OutboxService outbox;
    @Autowired IdempotencyService idem;
    @Autowired PlatformTransactionManager tm;

    /** A real user + active session, and a bearer token for it, exactly as the login flow would leave them. */
    private String bearer(String role) {
        String uid = "u-" + UUID.randomUUID();
        String sid = "s-" + UUID.randomUUID();
        String email = uid + "@example.test";
        // The role the endpoints see comes from the JWT claim. The DB row keeps a placeholder role because the
        // marketplace roles (SELLER, SELLER_STAFF) are only added to Prisma's UserRole enum in Phase 2.
        jdbc.update("""
                INSERT INTO "User" (id, name, email, password, "updatedAt")
                VALUES (?, 'T', ?, 'x', now())""", uid, email);
        jdbc.update("""
                INSERT INTO "UserSession" (id, "userId", "refreshToken", "expiresAt")
                VALUES (?, ?, ?, now() + interval '7 days')""", sid, uid, "r-" + sid);
        return "Bearer " + jwt.signAccessToken(new AccessClaims(uid, email, role, sid));
    }

    private void inTx(Runnable r) {
        new TransactionTemplate(tm).executeWithoutResult(s -> r.run());
    }

    // ---- migration -------------------------------------------------------------------------------

    @Test
    void flywayAdoptedPublicAsBaselineAndCreatedTheMarketplaceSchema() {
        // Existing (non-empty) database: V1 is recorded as the baseline, NOT executed; V2 runs for real.
        assertThat(jdbc.queryForObject(
                "SELECT count(*) FROM public.flyway_schema_history WHERE version = '1' AND type = 'BASELINE' AND success", Integer.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject(
                "SELECT count(*) FROM public.flyway_schema_history WHERE version = '2' AND type = 'SQL' AND success", Integer.class)).isEqualTo(1);
        assertThat(jdbc.queryForList("SELECT table_name FROM information_schema.tables WHERE table_schema = 'marketplace'", String.class))
                .contains("permission", "role_permission", "audit_log", "idempotency_key", "outbox_event");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM marketplace.permission", Integer.class)).isEqualTo(22);
    }

    @Test
    void permissionCodesMustBeWellFormed() {
        assertThatThrownBy(() -> jdbc.update("INSERT INTO marketplace.permission (code, description) VALUES ('Bad Code', 'x')"))
                .isInstanceOf(DataAccessException.class);
    }

    // ---- RBAC ------------------------------------------------------------------------------------

    @Test
    void rolesGetExactlyTheirSeededPermissions() {
        perm.evictAll();
        assertThat(perm.permissionsForRole("SUPER_ADMIN")).contains("marketplace.vendor.approve", "marketplace.settlement.approve")
                .noneMatch(p -> p.startsWith("vendor."));
        assertThat(perm.permissionsForRole("ACCOUNTS")).contains("marketplace.settlement.approve")
                .doesNotContain("marketplace.vendor.approve");
        assertThat(perm.permissionsForRole("SELLER")).contains("vendor.product.create", "vendor.settlement.view")
                .noneMatch(p -> p.startsWith("marketplace."));
        assertThat(perm.permissionsForRole("SELLER_STAFF")).contains("vendor.inventory.update")
                .doesNotContain("vendor.settlement.view", "vendor.product.create");
        // The existing procurement supplier role (and buyers) have no marketplace power at all.
        for (String role : new String[]{"VENDOR", "DEALER", "CUSTOMER", "GUEST", "STAFF", "SALES", "MARKETING"}) {
            assertThat(perm.permissionsForRole(role)).as(role).isEmpty();
        }
        assertThat(perm.permissionsForRole(null)).isEmpty();
    }

    @Test
    void serviceLevelGuardRejectsMissingPermission() {
        AuthenticatedUser dealer = new AuthenticatedUser("u", "e", "DEALER", "s");
        assertThatThrownBy(() -> perm.require(dealer, "marketplace.vendor.approve"))
                .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        perm.require(new AuthenticatedUser("u", "e", "ADMIN", "s"), "marketplace.vendor.approve"); // no throw
    }

    @Test
    void permissionEndpointsEnforceAuthenticationAndPermission() throws Exception {
        mvc.perform(get("/api/v1/me/permissions")).andExpect(status().isUnauthorized());

        mvc.perform(get("/api/v1/me/permissions").header("Authorization", bearer("ADMIN")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("ADMIN"))
                .andExpect(jsonPath("$.permissions[?(@ == 'marketplace.vendor.approve')]").exists());

        mvc.perform(get("/api/v1/me/permissions").header("Authorization", bearer("VENDOR")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.permissions").isEmpty());

        mvc.perform(get("/api/v1/admin/rbac/roles").header("Authorization", bearer("ADMIN")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.roles.SELLER").isArray());

        // Authenticated but unauthorised -> 403 with the standard error body (not a 500).
        mvc.perform(get("/api/v1/admin/rbac/roles").header("Authorization", bearer("DEALER")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value("Forbidden"));
        mvc.perform(get("/api/v1/admin/rbac/roles").header("Authorization", bearer("SELLER")))
                .andExpect(status().isForbidden());
    }

    @Test
    void openApiSpecIsServedToAuthenticatedCallersOnly() throws Exception {
        mvc.perform(get("/api/v1/openapi")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/openapi").header("Authorization", bearer("ADMIN")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.openapi").exists())
                .andExpect(jsonPath("$.paths['/api/v1/me/permissions']").exists());
    }

    // ---- audit log -------------------------------------------------------------------------------

    @Test
    void auditLogIsAppendOnly() {
        String entity = "ent-" + UUID.randomUUID();
        AuthenticatedUser admin = new AuthenticatedUser("u1", "a@b.c", "ADMIN", "s1");
        inTx(() -> audit.record(admin, "vendor.approve", "Vendor", entity, entity, "203.0.113.9", Map.of("reason", "kyc ok", "n", 1)));

        assertThat(jdbc.queryForObject("SELECT count(*) FROM marketplace.audit_log WHERE entity_id = ?", Integer.class, entity)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT details->>'reason' FROM marketplace.audit_log WHERE entity_id = ?", String.class, entity)).isEqualTo("kyc ok");

        assertThatThrownBy(() -> jdbc.update("UPDATE marketplace.audit_log SET action = 'x' WHERE entity_id = ?", entity))
                .hasMessageContaining("append-only");
        assertThatThrownBy(() -> jdbc.update("DELETE FROM marketplace.audit_log WHERE entity_id = ?", entity))
                .hasMessageContaining("append-only");
        assertThatThrownBy(() -> jdbc.execute("TRUNCATE marketplace.audit_log"))
                .hasMessageContaining("append-only");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM marketplace.audit_log WHERE entity_id = ?", Integer.class, entity)).isEqualTo(1);
    }

    @Test
    void auditRowCommitsOrRollsBackWithTheActionItDescribes() {
        String entity = "ent-" + UUID.randomUUID();
        assertThatThrownBy(() -> inTx(() -> {
            audit.record(null, "settlement.approve", "Settlement", entity, null, null, Map.of());
            throw new IllegalStateException("action failed after auditing");
        })).isInstanceOf(IllegalStateException.class);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM marketplace.audit_log WHERE entity_id = ?", Integer.class, entity)).isZero();

        // Without a surrounding transaction the audit write is refused outright.
        assertThatThrownBy(() -> audit.record(null, "x", "Y", entity, null, null, Map.of()))
                .isInstanceOf(IllegalTransactionStateException.class);
    }

    // ---- outbox ----------------------------------------------------------------------------------

    @Test
    void outboxEventExistsOnlyIfTheTransactionCommits() {
        String agg = "agg-" + UUID.randomUUID();
        assertThatThrownBy(() -> inTx(() -> {
            outbox.publish("Payment", agg, "PaymentCaptured", "{\"a\":1}");
            throw new IllegalStateException("boom");
        })).isInstanceOf(IllegalStateException.class);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM marketplace.outbox_event WHERE aggregate_id = ?", Integer.class, agg)).isZero();

        inTx(() -> outbox.publish("Payment", agg, "PaymentCaptured", "{\"a\":1}"));
        Map<String, Object> row = jdbc.queryForMap("SELECT event_type, processed_at, attempts, payload->>'a' AS a FROM marketplace.outbox_event WHERE aggregate_id = ?", agg);
        assertThat(row.get("event_type")).isEqualTo("PaymentCaptured");
        assertThat(row.get("processed_at")).isNull();
        assertThat(row.get("attempts")).isEqualTo(0);
        assertThat(row.get("a")).isEqualTo("1");
    }

    // ---- idempotency -----------------------------------------------------------------------------

    private static String key() { return "key-" + UUID.randomUUID(); }

    @Test
    void replayReturnsTheStoredResponseWithoutRunningTheActionAgain() {
        String k = key();
        AtomicInteger runs = new AtomicInteger();
        String h = IdempotencyService.hash("{\"cart\":1}");

        StoredResponse first = idem.execute("checkout", k, h, Duration.ofHours(1), () -> new StoredResponse(201, "{\"order\":\"o" + runs.incrementAndGet() + "\"}"));
        StoredResponse second = idem.execute("checkout", k, h, Duration.ofHours(1), () -> new StoredResponse(201, "{\"order\":\"o" + runs.incrementAndGet() + "\"}"));

        assertThat(runs).hasValue(1);
        assertThat(second).isEqualTo(first);
        assertThat(second.body()).isEqualTo("{\"order\":\"o1\"}");
    }

    @Test
    void sameKeyWithADifferentRequestIsRejected() {
        String k = key();
        idem.execute("checkout", k, IdempotencyService.hash("A"), Duration.ofHours(1), () -> new StoredResponse(200, "{}"));
        assertThatThrownBy(() -> idem.execute("checkout", k, IdempotencyService.hash("B"), Duration.ofHours(1), () -> new StoredResponse(200, "{}")))
                .isInstanceOfSatisfying(ApiException.class, e -> {
                    assertThat(e.status().value()).isEqualTo(422);
                    assertThat(e.code()).isEqualTo("IDEMPOTENCY_KEY_REUSED");
                });
    }

    @Test
    void sameKeyInDifferentScopesIsIndependent() {
        String k = key();
        AtomicInteger runs = new AtomicInteger();
        String h = IdempotencyService.hash("A");
        idem.execute("checkout", k, h, Duration.ofHours(1), () -> { runs.incrementAndGet(); return new StoredResponse(200, "{}"); });
        idem.execute("payment", k, h, Duration.ofHours(1), () -> { runs.incrementAndGet(); return new StoredResponse(200, "{}"); });
        assertThat(runs).hasValue(2);
    }

    @Test
    void aFailedActionReleasesTheKeySoTheClientCanRetry() {
        String k = key();
        String h = IdempotencyService.hash("A");
        assertThatThrownBy(() -> idem.execute("checkout", k, h, Duration.ofHours(1), () -> { throw new IllegalStateException("gateway down"); }))
                .isInstanceOf(IllegalStateException.class);
        StoredResponse retry = idem.execute("checkout", k, h, Duration.ofHours(1), () -> new StoredResponse(201, "{\"ok\":true}"));
        assertThat(retry.status()).isEqualTo(201);
    }

    @Test
    void aConcurrentDuplicateIsToldToWaitAndTheActionRunsOnce() throws Exception {
        String k = key();
        String h = IdempotencyService.hash("A");
        AtomicInteger runs = new AtomicInteger();
        CountDownLatch started = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            Future<StoredResponse> slow = pool.submit(() -> idem.execute("checkout", k, h, Duration.ofHours(1), () -> {
                runs.incrementAndGet();
                started.countDown();
                try { release.await(10, TimeUnit.SECONDS); } catch (InterruptedException e) { throw new IllegalStateException(e); }
                return new StoredResponse(201, "{\"order\":\"o1\"}");
            }));
            assertThat(started.await(10, TimeUnit.SECONDS)).isTrue();

            assertThatThrownBy(() -> idem.execute("checkout", k, h, Duration.ofHours(1), () -> { runs.incrementAndGet(); return new StoredResponse(201, "{}"); }))
                    .isInstanceOfSatisfying(ApiException.class, e -> {
                        assertThat(e.status().value()).isEqualTo(409);
                        assertThat(e.code()).isEqualTo("IDEMPOTENCY_IN_PROGRESS");
                    });

            release.countDown();
            assertThat(slow.get(10, TimeUnit.SECONDS).status()).isEqualTo(201);
            // After completion the duplicate gets the original response.
            assertThat(idem.execute("checkout", k, h, Duration.ofHours(1), () -> { runs.incrementAndGet(); return new StoredResponse(500, "{}"); }).body())
                    .isEqualTo("{\"order\":\"o1\"}");
            assertThat(runs).hasValue(1);
        } finally {
            release.countDown();
            pool.shutdownNow();
        }
    }

    @Test
    void anExpiredClaimFromACrashedProcessCanBeTakenOver() {
        String k = key();
        String h = IdempotencyService.hash("A");
        jdbc.update("""
                INSERT INTO marketplace.idempotency_key (scope, idem_key, request_hash, status, expires_at)
                VALUES ('checkout', ?, ?, 'IN_PROGRESS', now() - interval '1 minute')""", k, h);
        StoredResponse r = idem.execute("checkout", k, h, Duration.ofHours(1), () -> new StoredResponse(201, "{\"recovered\":true}"));
        assertThat(r.body()).contains("recovered");
    }

    @Test
    void rejectsMissingOrAbsurdKeys() {
        for (String bad : new String[]{null, "short", "x".repeat(201)}) {
            assertThatThrownBy(() -> idem.execute("checkout", bad, "h", Duration.ofHours(1), () -> new StoredResponse(200, "{}")))
                    .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status().value()).isEqualTo(400));
        }
    }
}
