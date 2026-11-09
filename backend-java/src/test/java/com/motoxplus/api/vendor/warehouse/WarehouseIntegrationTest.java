package com.motoxplus.api.vendor.warehouse;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.motoxplus.api.IntegrationTestBase;
import com.motoxplus.api.delhivery.FakeDelhivery;
import com.motoxplus.api.security.JwtService;
import com.motoxplus.api.security.JwtService.AccessClaims;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.ResultActions;

/**
 * Vendor warehouse setup end to end: real PostgreSQL with Flyway through V6, the real security chain, and a local fake
 * Delhivery (HTTP mock). No real Delhivery call is ever made.
 */
class WarehouseIntegrationTest extends IntegrationTestBase {
    static final FakeDelhivery DELHIVERY = start();

    private static FakeDelhivery start() {
        try {
            return new FakeDelhivery();
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    @DynamicPropertySource
    static void marketplaceOn(DynamicPropertyRegistry r) {
        r.add("marketplace.enabled", () -> "true");
        r.add("app.db.migrate", () -> "true");
        r.add("app.db.baseline-guard", () -> "false");
        r.add("app.crypto.encryption-key", () -> "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff");
        r.add("app.delhivery.base-url", DELHIVERY::url);
        r.add("app.delhivery.token", () -> FakeDelhivery.TOKEN);
        r.add("app.delhivery.allow-writes", () -> "true");
        r.add("app.delhivery.warehouse.create-path", () -> FakeDelhivery.CREATE_PATH);
        r.add("app.delhivery.warehouse.exists-error", () -> FakeDelhivery.EXISTS_ERROR);
        r.add("app.delhivery.warehouse.name-max-length", () -> String.valueOf(FakeDelhivery.NAME_MAX));
    }

    @Autowired JwtService jwt;

    @BeforeEach
    void resetFake() {
        DELHIVERY.reset();
    }

    record Seller(String vendorId, String vendorCode, String bearer) {}

    private Seller seller(String vendorStatus) {
        String n = UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        String uid = "u-wh-" + n;
        String vid = "v-wh-" + n;
        String code = "VND" + String.format("%08d", ThreadLocalRandom.current().nextInt(100_000_000));
        String email = "wh-" + n + "@example.test";
        jdbc.update("""
                INSERT INTO "User" (id, name, email, password, role, "emailVerified", "mobileVerified", "mobileNumber", "isActive", "updatedAt")
                VALUES (?, 'Ravi Kumar', ?, 'x', 'VENDOR', now(), true, ?, true, now())""", uid, email, "+9198" + Math.abs(n.hashCode() % 100_000_000));
        jdbc.update("""
                INSERT INTO "Vendor" (id, "userId", "vendorCode", "companyName", "ownerName", email, phone, city, state, status, "updatedAt")
                VALUES (?, ?, ?, 'Kumar Auto Components', 'Ravi Kumar', ?, '9876543210', 'New Delhi', 'Delhi', ?::"VendorStatus", now())""",
                vid, uid, code, email, vendorStatus);
        String sid = "s-" + UUID.randomUUID();
        jdbc.update("INSERT INTO \"UserSession\" (id, \"userId\", \"refreshToken\", \"expiresAt\") VALUES (?, ?, ?, now() + interval '7 days')",
                sid, uid, "r-" + sid);
        return new Seller(vid, code, "Bearer " + jwt.signAccessToken(new AccessClaims(uid, email, "VENDOR", sid)));
    }

    private static String body(String pin) {
        return """
                {"address":"Plot 4, Okhla Industrial Area Phase 2","pin":"%s","city":"New Delhi","state":"Delhi",
                 "phone":"+91 98765 43210","email":"Dispatch@Kumar.example","returnSameAsPickup":true}""".formatted(pin);
    }

    private ResultActions submit(Seller s, String body) throws Exception {
        return mvc.perform(post("/api/v1/vendors/me/warehouse").header("Authorization", s.bearer())
                .contentType(MediaType.APPLICATION_JSON).content(body));
    }

    private ResultActions retry(Seller s) throws Exception {
        return mvc.perform(post("/api/v1/vendors/me/warehouse/retry").header("Authorization", s.bearer()));
    }

    private ResultActions publishAnything(Seller s) throws Exception {
        return mvc.perform(post("/api/v1/vendors/me/listings/l-does-not-matter/publish").header("Authorization", s.bearer()));
    }

    private Map<String, Object> row(Seller s) {
        return jdbc.queryForMap("SELECT status::text AS status, \"delhiveryName\", \"lastError\", \"lastErrorCode\", attempts, phone, email, "
                + "\"returnPin\", \"activatedAt\" FROM \"DelhiveryWarehouse\" WHERE \"vendorId\" = ?", s.vendorId());
    }

    private List<String> audit(Seller s) {
        return jdbc.queryForList("SELECT action FROM marketplace.audit_log WHERE entity_type = 'warehouse' AND vendor_id = ? ORDER BY occurred_at, id",
                String.class, s.vendorId());
    }

    // ------------------------------------------------------------------ success

    @Test
    void submittingChecksThePinThenCreatesTheWarehouseOnDelhiveryAndActivatesIt() throws Exception {
        Seller s = seller("APPROVED");
        String name = "VND-" + s.vendorCode() + "-110020";

        submit(s, body("110020")).andExpect(status().isOk())
                .andExpect(jsonPath("$.warehouse.status").value("ACTIVE"))
                .andExpect(jsonPath("$.warehouse.delhiveryName").value(name))
                .andExpect(jsonPath("$.canRetry").value(false))
                .andExpect(jsonPath("$.canSubmit").value(false));

        // Serviceability first, then exactly one create call with the reserved name and the server-side token.
        assertThat(DELHIVERY.calls).extracting(FakeDelhivery.Call::path).containsExactly("/c/api/pin-codes/json/", FakeDelhivery.CREATE_PATH);
        assertThat(DELHIVERY.creates().get(0).body()).contains("\"name\":\"" + name + "\"");
        Map<String, Object> r = row(s);
        assertThat(r).containsEntry("status", "ACTIVE").containsEntry("delhiveryName", name).containsEntry("attempts", 1)
                .containsEntry("phone", "9876543210").containsEntry("email", "dispatch@kumar.example").containsEntry("returnPin", "110020");
        assertThat(r.get("activatedAt")).isNotNull();
        assertThat(r.get("lastError")).isNull();
        assertThat(audit(s)).containsExactly("vendor.warehouse.submitted", "vendor.warehouse.activated");

        // Retrying an active warehouse is a no-op, and a second submit is refused: one warehouse per vendor.
        retry(s).andExpect(status().isOk()).andExpect(jsonPath("$.warehouse.status").value("ACTIVE"));
        submit(s, body("110001")).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("WAREHOUSE_ACTIVE"));
        assertThat(DELHIVERY.creates()).hasSize(1);
    }

    @Test
    void aPinDelhiveryCannotCollectFromIsRefusedBeforeAnythingIsCreated() throws Exception {
        Seller s = seller("APPROVED");
        DELHIVERY.pins.put("793001", FakeDelhivery.postal("793001", "N"));
        DELHIVERY.pins.put("999999", "");

        submit(s, body("793001")).andExpect(status().isBadRequest()).andExpect(jsonPath("$.fieldErrors.pin").exists());
        submit(s, body("999999")).andExpect(status().isBadRequest()).andExpect(jsonPath("$.fieldErrors.pin").exists());

        assertThat(DELHIVERY.creates()).isEmpty();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM \"DelhiveryWarehouse\" WHERE \"vendorId\" = ?", Integer.class, s.vendorId())).isZero();
    }

    // ------------------------------------------------------------------ failure and retry

    @Test
    void aRejectedSetupIsFailedWithTheReasonAndCanBeCorrectedOrRetried() throws Exception {
        Seller s = seller("APPROVED");
        DELHIVERY.createReplies.add(new FakeDelhivery.Reply(400, "{\"success\":false,\"error\":\"Address too short for pickup\"}"));

        submit(s, body("110020")).andExpect(status().isOk())
                .andExpect(jsonPath("$.warehouse.status").value("FAILED"))
                .andExpect(jsonPath("$.warehouse.lastError").value(org.hamcrest.Matchers.containsString("Address too short")))
                .andExpect(jsonPath("$.canRetry").value(true))
                .andExpect(jsonPath("$.canSubmit").value(true));
        assertThat(row(s)).containsEntry("status", "FAILED").containsEntry("lastErrorCode", "REJECTED");

        // Not created on Delhivery, so the vendor may correct the details (new PIN, so a new name).
        submit(s, body("110001")).andExpect(status().isOk()).andExpect(jsonPath("$.warehouse.status").value("ACTIVE"))
                .andExpect(jsonPath("$.warehouse.delhiveryName").value("VND-" + s.vendorCode() + "-110001"));
        assertThat(row(s)).containsEntry("attempts", 2);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM \"DelhiveryWarehouse\" WHERE \"vendorId\" = ?", Integer.class, s.vendorId())).isEqualTo(1);
        assertThat(audit(s)).containsExactly("vendor.warehouse.submitted", "vendor.warehouse.failed",
                "vendor.warehouse.submitted", "vendor.warehouse.activated");
    }

    @Test
    void aRetryAfterAnUncertainFailureReusesTheNameAndAnExistsAnswerActivates() throws Exception {
        Seller s = seller("APPROVED");
        String name = "VND-" + s.vendorCode() + "-110020";
        DELHIVERY.createReplies.add(new FakeDelhivery.Reply(502, "upstream timeout"));

        submit(s, body("110020")).andExpect(status().isOk()).andExpect(jsonPath("$.warehouse.status").value("FAILED"))
                .andExpect(jsonPath("$.canSubmit").value(false)).andExpect(jsonPath("$.canRetry").value(true));
        assertThat(row(s)).containsEntry("lastErrorCode", "UNCERTAIN");

        // Delhivery may have it already, so the details (and the permanent name) are frozen...
        submit(s, body("110001")).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("WAREHOUSE_LOCKED"));

        // ...and the retry sends the SAME name. Delhivery says it exists: our first attempt did go through.
        DELHIVERY.createReplies.add(new FakeDelhivery.Reply(400, "{\"success\":false,\"error\":\"" + FakeDelhivery.EXISTS_ERROR + "\"}"));
        retry(s).andExpect(status().isOk()).andExpect(jsonPath("$.warehouse.status").value("ACTIVE"))
                .andExpect(jsonPath("$.warehouse.delhiveryName").value(name));

        assertThat(DELHIVERY.creates()).hasSize(2).allSatisfy(c -> assertThat(c.body()).contains("\"name\":\"" + name + "\""));
        assertThat(row(s)).containsEntry("status", "ACTIVE").containsEntry("attempts", 2);
        assertThat(audit(s)).containsExactly("vendor.warehouse.submitted", "vendor.warehouse.failed",
                "vendor.warehouse.retried", "vendor.warehouse.activated");
    }

    @Test
    void anAttemptInFlightCannotBeStartedTwice() throws Exception {
        Seller s = seller("APPROVED");
        jdbc.update("""
                INSERT INTO "DelhiveryWarehouse" (id, "ownerType", "vendorId", "delhiveryName", address, pin, city, state, phone, email,
                    "returnAddress", "returnPin", "returnCity", "returnState", status, attempts, "attemptStartedAt")
                VALUES (?, 'VENDOR', ?, ?, 'Plot 4, Okhla', '110020', 'New Delhi', 'Delhi', '9876543210', 'a@b.in',
                    'Plot 4, Okhla', '110020', 'New Delhi', 'Delhi', 'PENDING', 1, (now() AT TIME ZONE 'UTC'))""",
                "w-" + s.vendorId(), s.vendorId(), "VND-" + s.vendorCode() + "-110020");

        retry(s).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("WAREHOUSE_IN_PROGRESS"));
        submit(s, body("110020")).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("WAREHOUSE_LOCKED"));

        // Abandoned (the process died mid-call): after the stale window it can be retried, with the same name.
        jdbc.update("UPDATE \"DelhiveryWarehouse\" SET \"attemptStartedAt\" = \"attemptStartedAt\" - interval '10 minutes' WHERE \"vendorId\" = ?",
                s.vendorId());
        retry(s).andExpect(status().isOk()).andExpect(jsonPath("$.warehouse.status").value("ACTIVE"));
        assertThat(DELHIVERY.creates()).hasSize(1);
    }

    @Test
    void anAuthRefusalCreatesNothingKeepsTheDetailsEditableAndTheTokenOutOfTheError() throws Exception {
        // Delhivery refused the token: nothing was created, so the vendor may still correct the details.
        Seller s = seller("APPROVED");
        DELHIVERY.createReplies.add(new FakeDelhivery.Reply(401, "{\"detail\":\"Invalid token " + FakeDelhivery.TOKEN + "\"}"));

        submit(s, body("110020")).andExpect(status().isOk()).andExpect(jsonPath("$.warehouse.status").value("FAILED"))
                .andExpect(jsonPath("$.canSubmit").value(true));
        Map<String, Object> r = row(s);
        assertThat(r).containsEntry("lastErrorCode", "NOT_SENT");
        assertThat((String) r.get("lastError")).doesNotContain(FakeDelhivery.TOKEN);
    }

    // ------------------------------------------------------------------ duplicate name

    @Test
    void aNameAlreadyHeldInOurDatabaseIsRefusedBeforeDelhiveryIsCalled() throws Exception {
        Seller s = seller("APPROVED");
        Seller other = seller("APPROVED");
        // Should never happen (vendor codes are unique), but the name is permanent, so it is checked anyway.
        jdbc.update("""
                INSERT INTO "DelhiveryWarehouse" (id, "ownerType", "vendorId", "delhiveryName", address, pin, city, state, phone, email,
                    "returnAddress", "returnPin", "returnCity", "returnState", status)
                VALUES (?, 'VENDOR', ?, ?, 'Plot 4, Okhla', '110020', 'New Delhi', 'Delhi', '9876543210', 'a@b.in',
                    'Plot 4, Okhla', '110020', 'New Delhi', 'Delhi', 'FAILED')""",
                "w-" + other.vendorId(), other.vendorId(), "VND-" + s.vendorCode() + "-110020");

        submit(s, body("110020")).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("WAREHOUSE_NAME_TAKEN"));

        assertThat(DELHIVERY.creates()).isEmpty();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM \"DelhiveryWarehouse\" WHERE \"vendorId\" = ?", Integer.class, s.vendorId())).isZero();
    }

    // ------------------------------------------------------------------ listing gate

    @Test
    void aVendorWithoutAnActiveWarehouseCannotPutProductsLive() throws Exception {
        Seller s = seller("APPROVED");
        publishAnything(s).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("WAREHOUSE_NOT_ACTIVE"));
        mvc.perform(get("/api/v1/vendors/me/listings/overview").header("Authorization", s.bearer()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.warehouseStatus").doesNotExist());

        DELHIVERY.createReplies.add(new FakeDelhivery.Reply(502, "upstream timeout"));
        submit(s, body("110020")).andExpect(jsonPath("$.warehouse.status").value("FAILED"));
        publishAnything(s).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("WAREHOUSE_NOT_ACTIVE"));

        jdbc.update("UPDATE \"DelhiveryWarehouse\" SET status = 'PENDING' WHERE \"vendorId\" = ?", s.vendorId());
        publishAnything(s).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("WAREHOUSE_NOT_ACTIVE"));

        // Once ACTIVE the gate opens; the (nonexistent) listing is then what stops it.
        jdbc.update("UPDATE \"DelhiveryWarehouse\" SET status = 'FAILED' WHERE \"vendorId\" = ?", s.vendorId());
        retry(s).andExpect(jsonPath("$.warehouse.status").value("ACTIVE"));
        publishAnything(s).andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/vendors/me/listings/overview").header("Authorization", s.bearer()))
                .andExpect(jsonPath("$.warehouseStatus").value("ACTIVE"));
    }

    @Test
    void aVendorStillAwaitingApprovalCannotSetUpAWarehouse() throws Exception {
        Seller s = seller("PENDING");
        submit(s, body("110020")).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("VENDOR_NOT_ACTIVE"));
        assertThat(DELHIVERY.calls).isEmpty();
    }
}
