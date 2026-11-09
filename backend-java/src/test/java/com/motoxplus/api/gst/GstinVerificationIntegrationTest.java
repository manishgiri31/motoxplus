package com.motoxplus.api.gst;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.motoxplus.api.IntegrationTestBase;
import com.motoxplus.api.common.Cuid;
import com.motoxplus.api.notify.FakeHttp;
import java.io.IOException;
import java.io.UncheckedIOException;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.support.TransactionTemplate;

/** B2B/B2C classification (Flyway V5) and live GSTIN verification, against PostgreSQL + Flyway V1..V5. */
class GstinVerificationIntegrationTest extends IntegrationTestBase {
    static final String TOKEN = "internal-token-internal-token-internal-token";
    static final String GSTIN = "27AAPFU0939F1ZV";
    static final FakeHttp REGISTRY = start();

    private static FakeHttp start() {
        try { return new FakeHttp(); } catch (IOException e) { throw new UncheckedIOException(e); }
    }

    @DynamicPropertySource
    static void gstProps(DynamicPropertyRegistry r) {
        r.add("app.db.migrate", () -> "true");
        r.add("app.db.baseline-guard", () -> "false");
        r.add("app.internal.token", () -> TOKEN);
        r.add("app.gst.cashfree.client-id", () -> "cf-id");
        r.add("app.gst.cashfree.client-secret", () -> "cf-secret");
        r.add("app.gst.cashfree.base-url", () -> REGISTRY.url());
        r.add("app.gst.recheck.initial-delay-ms", () -> "3600000"); // the test drives the job itself
    }

    @Autowired GstinRecheckJob job;
    @Autowired TransactionTemplate tx;

    private static final String ACTIVE = """
            {"valid": true, "gst_in_status": "Active", "legal_name_of_business": "ACME AUTO PARTS",
             "principal_place_address": "12 MG Road, Pune"}""";

    private String insertUser(String role) {
        String id = Cuid.next();
        jdbc.update("""
                INSERT INTO public."User" (id, email, role, "updatedAt")
                VALUES (?, ?, ?::"UserRole", now())
                """, id, id + "@example.test", role);
        return id;
    }

    private String insertDealer(String userId, String gstin, String verificationStatus) {
        String id = Cuid.next();
        jdbc.update("""
                INSERT INTO public."Dealer" (id, "userId", "companyName", "gstNumber", "ownerName", phone, state, city,
                                             "gstVerificationStatus", "updatedAt")
                VALUES (?, ?, 'Acme', ?, 'Owner', '9876500000', 'Maharashtra', 'Pune', ?::"GstinVerificationStatus", now())
                """, id, userId, gstin, verificationStatus);
        return id;
    }

    private String customerType(String userId) {
        return jdbc.queryForObject("SELECT \"customerType\"::text FROM public.\"User\" WHERE id = ?", String.class, userId);
    }

    @Test
    void customerTypeFollowsRoleAndB2bCannotBecomeB2cWithoutApproval() {
        String dealer = insertUser("DEALER");
        String customer = insertUser("CUSTOMER");
        String staff = insertUser("STAFF");
        assertThat(customerType(dealer)).isEqualTo("B2B");
        assertThat(customerType(customer)).isEqualTo("B2C");
        assertThat(customerType(staff)).isNull();

        assertThatThrownBy(() -> jdbc.update("UPDATE public.\"User\" SET \"customerType\" = 'B2C' WHERE id = ?", dealer))
                .hasMessageContaining("cannot be changed to B2C");
        assertThatThrownBy(() -> jdbc.update("UPDATE public.\"User\" SET role = 'CUSTOMER' WHERE id = ?", dealer))
                .hasMessageContaining("cannot be changed to B2C");
        assertThat(customerType(dealer)).isEqualTo("B2B");

        // The approved account-update process opts in explicitly, for one transaction only.
        tx.executeWithoutResult(s -> {
            jdbc.execute("SET LOCAL app.customer_type_change = 'approved'");
            jdbc.update("UPDATE public.\"User\" SET role = 'CUSTOMER', \"customerType\" = 'B2C' WHERE id = ?", dealer);
        });
        assertThat(customerType(dealer)).isEqualTo("B2C");

        // B2C -> B2B (a retail customer upgraded to a dealer) is not restricted.
        jdbc.update("UPDATE public.\"User\" SET role = 'DEALER', \"customerType\" = NULL WHERE id = ?", customer);
        assertThat(customerType(customer)).isEqualTo("B2B");
    }

    @Test
    void internalEndpointNeedsTheTokenAndNeverTrustsFormatAlone() throws Exception {
        String body = "{\"gstin\": \"" + GSTIN + "\"}";
        mvc.perform(post("/api/internal/gstin/verify").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isNotFound());
        mvc.perform(post("/api/internal/gstin/verify").header("X-Internal-Token", "wrong")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isNotFound());

        REGISTRY.respond(200, ACTIVE);
        mvc.perform(post("/api/internal/gstin/verify").header("X-Internal-Token", TOKEN)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"gstin\": \" 27aapfu0939f1zv \"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.gstin").value(GSTIN))
                .andExpect(jsonPath("$.status").value("VERIFIED"))
                .andExpect(jsonPath("$.legalName").value("ACME AUTO PARTS"))
                .andExpect(jsonPath("$.registrationStatus").value("Active"));

        // Well-formed, but the registry has never heard of it.
        REGISTRY.respond(200, "{\"valid\": false}");
        mvc.perform(post("/api/internal/gstin/verify").header("X-Internal-Token", TOKEN)
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(jsonPath("$.status").value("INVALID"));

        // Registry down: undecided (PENDING), never valid.
        REGISTRY.respond(503, "{}");
        mvc.perform(post("/api/internal/gstin/verify").header("X-Internal-Token", TOKEN)
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(jsonPath("$.status").value("PENDING"));

        // Bad check digit: rejected without a registry call.
        int calls = REGISTRY.requests.size();
        mvc.perform(post("/api/internal/gstin/verify").header("X-Internal-Token", TOKEN)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"gstin\": \"27AAPFU0939F1ZW\"}"))
                .andExpect(jsonPath("$.status").value("INVALID"));
        assertThat(REGISTRY.requests).hasSize(calls);
    }

    @Test
    void recheckJobVerifiesPendingDealersAndLeavesStaffDecisionsAlone() {
        jdbc.update("UPDATE public.\"Dealer\" SET \"gstVerificationStatus\" = NULL WHERE \"gstVerificationStatus\" = 'PENDING'");
        String pending = insertDealer(insertUser("DEALER"), GSTIN, "PENDING");
        String staffVerified = insertDealer(insertUser("DEALER"), "29AAGCB7383J1Z4", "VERIFIED");

        REGISTRY.respond(503, "{}");
        job.recheckBatch();
        var row = jdbc.queryForMap("SELECT * FROM public.\"Dealer\" WHERE id = ?", pending);
        assertThat(row.get("gstVerificationStatus").toString()).isEqualTo("PENDING");
        assertThat(row.get("gstVerified")).isEqualTo(false);
        assertThat(row.get("gstCheckAttempts")).isEqualTo(1);

        // Backed off: an immediate second run does not hit the registry again for this dealer.
        int calls = REGISTRY.requests.size();
        job.recheckBatch();
        assertThat(REGISTRY.requests).hasSize(calls);

        jdbc.update("UPDATE public.\"Dealer\" SET \"gstLastCheckedAt\" = (now() AT TIME ZONE 'UTC') - interval '2 hours' WHERE id = ?", pending);
        REGISTRY.respond(200, ACTIVE);
        job.recheckBatch();
        row = jdbc.queryForMap("SELECT * FROM public.\"Dealer\" WHERE id = ?", pending);
        assertThat(row.get("gstVerificationStatus").toString()).isEqualTo("VERIFIED");
        assertThat(row.get("gstVerified")).isEqualTo(true);
        assertThat(row.get("gstVerifiedAt")).isNotNull();
        assertThat(row.get("gstVerificationSource")).isEqualTo("GST_API");
        assertThat(row.get("gstLegalName")).isEqualTo("ACME AUTO PARTS");
        assertThat(row.get("gstPrincipalAddress")).isEqualTo("12 MG Road, Pune");

        var untouched = jdbc.queryForMap("SELECT * FROM public.\"Dealer\" WHERE id = ?", staffVerified);
        assertThat(untouched.get("gstCheckAttempts")).isEqualTo(0);
    }
}
