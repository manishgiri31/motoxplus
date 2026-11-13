package com.motoxplus.api.vendor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.motoxplus.api.IntegrationTestBase;
import com.motoxplus.api.common.FieldCrypto;
import com.motoxplus.api.notify.FakeHttp;
import com.motoxplus.api.security.JwtService;
import com.motoxplus.api.security.JwtService.AccessClaims;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.ResultActions;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** Vendor registration -> onboarding -> submission -> admin review, end to end against PostgreSQL + Flyway V1..V3. */
class VendorOnboardingIntegrationTest extends IntegrationTestBase {
    static final String KEY_HEX = "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff";
    static final FakeHttp R2 = startR2();

    private static FakeHttp startR2() {
        try {
            return new FakeHttp().respond(200, "");
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    @DynamicPropertySource
    static void marketplaceOn(DynamicPropertyRegistry r) {
        r.add("marketplace.enabled", () -> "true");
        r.add("app.db.migrate", () -> "true");
        r.add("app.db.baseline-guard", () -> "false");
        r.add("app.crypto.encryption-key", () -> KEY_HEX);
        r.add("app.r2.account-id", () -> "acct");
        r.add("app.r2.access-key-id", () -> "AKID");
        r.add("app.r2.secret-access-key", () -> "SECRET");
        r.add("app.r2.bucket", () -> "motoxplus-assets");
        r.add("app.r2.private-bucket", () -> "motoxplus-kyc");
        r.add("app.r2.public-url", () -> "https://pub.example.r2.dev");
        r.add("app.r2.endpoint", () -> R2.url());
    }

    @Autowired JwtService jwt;
    @Autowired FieldCrypto crypto;
    private final JsonMapper json = JsonMapper.builder().build();

    static final byte[] PDF = "%PDF-1.4\n%test\n".getBytes();
    static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0};

    @BeforeEach
    void catalogue() {
        jdbc.update("""
                INSERT INTO "Category" (id, name, slug, "sortOrder", "isActive", "updatedAt") VALUES
                ('it-brakes', 'IT Brake System', 'it-brake-system', 1, true, now()) ON CONFLICT (id) DO NOTHING""");
        jdbc.update("""
                INSERT INTO "Category" (id, name, slug, "sortOrder", "isActive", "parentId", "updatedAt") VALUES
                ('it-pads', 'IT Brake Pads', 'it-brake-pads', 1, true, 'it-brakes', now()),
                ('it-discs', 'IT Brake Discs', 'it-brake-discs', 2, true, 'it-brakes', now()) ON CONFLICT (id) DO NOTHING""");
    }

    // ------------------------------------------------------------------ helpers

    record Vendor(String userId, String vendorId, String email, String bearer) {}

    private Vendor register() throws Exception {
        String n = UUID.randomUUID().toString().substring(0, 8);
        String email = "vendor-" + n + "@example.test";
        String mobile = "9" + String.format("%09d", Math.abs(n.hashCode()) % 1_000_000_000);
        String body = """
                {"fullName":"Ravi Kumar","mobile":"%s","email":"%s","password":"Spare-Parts-2026"}""".formatted(mobile, email);
        JsonNode res = read(mvc.perform(post("/api/v1/vendors/register").contentType(MediaType.APPLICATION_JSON).content(body)
                        .header("X-Real-IP", "10.0.0." + (Math.abs(n.hashCode()) % 200)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("PENDING_VERIFICATION")));
        String userId = res.get("userId").asString();
        return new Vendor(userId, res.get("vendorId").asString(), email, bearerFor(userId, email, "VENDOR"));
    }

    private String bearerFor(String userId, String email, String role) {
        String sid = "s-" + UUID.randomUUID();
        jdbc.update("""
                INSERT INTO "UserSession" (id, "userId", "refreshToken", "expiresAt") VALUES (?, ?, ?, now() + interval '7 days')""",
                sid, userId, "r-" + sid);
        return "Bearer " + jwt.signAccessToken(new AccessClaims(userId, email, role, sid));
    }

    private String staff(String role) {
        String uid = "u-" + UUID.randomUUID();
        jdbc.update("INSERT INTO \"User\" (id, name, email, password, \"updatedAt\") VALUES (?, 'Reviewer', ?, 'x', now())", uid, uid + "@x.test");
        return bearerFor(uid, uid + "@x.test", role);
    }

    private void verifyContacts(Vendor v) {
        jdbc.update("UPDATE \"User\" SET \"emailVerified\" = now(), \"mobileVerified\" = true WHERE id = ?", v.userId());
    }

    /** Older applications (and ones an admin reopens) still go through admin review; this recreates that starting point. */
    private Vendor asReviewedApplicant(Vendor v) {
        jdbc.update("UPDATE \"Vendor\" SET status = 'PENDING' WHERE id = ?", v.vendorId());
        jdbc.update("UPDATE marketplace.vendor_application SET decision = NULL, decided_at = NULL, decided_by = NULL WHERE vendor_id = ?",
                v.vendorId());
        return v;
    }

    private JsonNode read(ResultActions r) throws Exception {
        return json.readTree(r.andReturn().getResponse().getContentAsString());
    }

    private ResultActions putJson(Vendor v, String path, String body) throws Exception {
        return mvc.perform(put("/api/v1/vendors/me/application/" + path).header("Authorization", v.bearer())
                .contentType(MediaType.APPLICATION_JSON).content(body));
    }

    private ResultActions upload(Vendor v, String type, byte[] bytes, String name) throws Exception {
        return mvc.perform(multipart("/api/v1/vendors/me/application/documents")
                .file(new MockMultipartFile("file", name, "application/octet-stream", bytes))
                .param("documentType", type).header("Authorization", v.bearer()));
    }

    private static final String BUSINESS = """
            {"businessName":"Kumar Auto Components","businessType":"MANUFACTURER","pan":"ABCDE1234F","gstin":"07ABCDE1234F1Z5",
             "address":"Plot 12, Industrial Area Phase 2","state":"Delhi","city":"New Delhi","pincode":"110020"}""";

    private Vendor readyToSubmit() throws Exception {
        Vendor v = register();
        verifyContacts(v);
        // Each vendor needs its own GSTIN/PAN (GSTIN is unique across vendors).
        StringBuilder letters = new StringBuilder();
        var rnd = java.util.concurrent.ThreadLocalRandom.current();
        for (int i = 0; i < 5; i++) letters.append((char) ('A' + rnd.nextInt(26)));
        String pan = letters + "1234F";
        String business = BUSINESS.replace("ABCDE1234F", pan);
        putJson(v, "business", business).andExpect(status().isOk());
        putJson(v, "categories", "{\"categoryIds\":[\"it-pads\"],\"vehicleSegments\":[\"MOTORCYCLE\",\"SCOOTER\"]}").andExpect(status().isOk());
        putJson(v, "bank", """
                {"accountHolder":"Kumar Auto Components","bankName":"HDFC Bank","accountNumber":"50100123456789","ifsc":"HDFC0001234"}""")
                .andExpect(status().isOk());
        upload(v, "PAN_CARD", PDF, "pan.pdf").andExpect(status().isOk());
        upload(v, "GST_CERTIFICATE", PDF, "gst.pdf").andExpect(status().isOk());
        upload(v, "CANCELLED_CHEQUE", PNG, "cheque.png").andExpect(status().isOk());
        return v;
    }

    private static final String DECLARATIONS = """
            {"acceptTerms":true,"acceptVendorAgreement":true,"declareGenuineProducts":true,"declareAccurateInformation":true}""";

    // ------------------------------------------------------------------ registration

    @Test
    void registrationCreatesAnAutoApprovedUnverifiedVendorAndRejectsDuplicatesAndWeakPasswords() throws Exception {
        Vendor v = register();
        assertThat(jdbc.queryForObject("SELECT role::text FROM \"User\" WHERE id = ?", String.class, v.userId())).isEqualTo("VENDOR");
        assertThat(jdbc.queryForObject("SELECT \"mobileVerified\" FROM \"User\" WHERE id = ?", Boolean.class, v.userId())).isFalse();
        // Approved like a dealer; verification still gates everything.
        assertThat(jdbc.queryForObject("SELECT status::text FROM \"Vendor\" WHERE id = ?", String.class, v.vendorId())).isEqualTo("APPROVED");
        assertThat(jdbc.queryForObject("SELECT decision || '/' || decided_by FROM marketplace.vendor_application WHERE vendor_id = ?",
                String.class, v.vendorId())).isEqualTo("APPROVED/system:auto-approval");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM \"OtpCode\" WHERE \"userId\" = ? AND type = 'EMAIL_VERIFICATION'",
                Integer.class, v.userId())).isEqualTo(1);
        String hash = jdbc.queryForObject("SELECT password FROM \"User\" WHERE id = ?", String.class, v.userId());
        assertThat(hash).startsWith("$2a$12$"); // bcrypt cost 12, readable by Node's bcryptjs

        mvc.perform(post("/api/v1/vendors/register").contentType(MediaType.APPLICATION_JSON).header("X-Real-IP", "10.1.1.1")
                        .content("{\"fullName\":\"Other\",\"mobile\":\"9123456780\",\"email\":\"" + v.email() + "\",\"password\":\"Spare-Parts-2026\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.fieldErrors.email").value("Email already registered"));

        mvc.perform(post("/api/v1/vendors/register").contentType(MediaType.APPLICATION_JSON).header("X-Real-IP", "10.1.1.2")
                        .content("{\"fullName\":\"A\",\"mobile\":\"123\",\"email\":\"bad\",\"password\":\"password\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.fieldErrors.fullName").exists())
                .andExpect(jsonPath("$.fieldErrors.mobile").exists())
                .andExpect(jsonPath("$.fieldErrors.email").exists())
                .andExpect(jsonPath("$.fieldErrors.password").exists());
    }

    // ------------------------------------------------------------------ onboarding

    @Test
    void onboardingIsLockedUntilEmailAndMobileAreVerified() throws Exception {
        Vendor v = register();
        mvc.perform(get("/api/v1/vendors/me/application").header("Authorization", v.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.state").value("PENDING_VERIFICATION"));
        putJson(v, "business", BUSINESS).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("VERIFICATION_REQUIRED"));

        mvc.perform(get("/api/v1/vendors/me/listings/overview").header("Authorization", v.bearer()))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("VENDOR_NOT_ACTIVE"));

        verifyContacts(v);
        mvc.perform(get("/api/v1/vendors/me/application").header("Authorization", v.bearer()))
                .andExpect(jsonPath("$.state").value("ACTIVE"))
                .andExpect(jsonPath("$.editable").value(true))
                .andExpect(jsonPath("$.profileComplete").value(false));
    }

    @Test
    void autoApprovedVendorCompletesProfileBeforeSelling() throws Exception {
        Vendor v = readyToSubmit();
        // Active, but selling waits for the business profile.
        mvc.perform(get("/api/v1/vendors/me/listings/overview").header("Authorization", v.bearer()))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("PROFILE_INCOMPLETE"));

        mvc.perform(post("/api/v1/vendors/me/application/submit").header("Authorization", v.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content(DECLARATIONS))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.state").value("ACTIVE"))
                .andExpect(jsonPath("$.profileComplete").value(true))
                .andExpect(jsonPath("$.editable").value(false))
                .andExpect(jsonPath("$.decision.decision").value("APPROVED"));
        assertThat(jdbc.queryForObject("SELECT status::text FROM \"Vendor\" WHERE id = ?", String.class, v.vendorId())).isEqualTo("APPROVED");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM marketplace.audit_log WHERE entity_id = ? AND action = 'vendor.profile.completed'",
                Integer.class, v.vendorId())).isEqualTo(1);

        mvc.perform(get("/api/v1/vendors/me/listings/overview").header("Authorization", v.bearer())).andExpect(status().isOk());
        // Registered details are locked again once complete (changes go through MotoXPlus).
        putJson(v, "bank", "{}").andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("APPLICATION_LOCKED"));

        // An admin can still suspend an auto-approved vendor.
        mvc.perform(post("/api/v1/admin/vendor-applications/" + v.vendorId() + "/suspend").header("Authorization", staff("ADMIN"))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"Counterfeit complaint under investigation\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.state").value("SUSPENDED"));
    }

    @Test
    void businessStepValidatesPanGstinAndState() throws Exception {
        Vendor v = register();
        verifyContacts(v);
        putJson(v, "business", BUSINESS.replace("ABCDE1234F\",\"gstin", "ABCDE12\",\"gstin"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.fieldErrors.pan").value("PAN looks like ABCDE1234F"));
        putJson(v, "business", BUSINESS.replace("07ABCDE1234F1Z5", "07ZZZZZ9999Z1Z5"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.gstin").value("This GSTIN does not belong to the PAN you entered"));
        putJson(v, "business", BUSINESS.replace("\"Delhi\"", "\"Atlantis\""))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.fieldErrors.state").value("Select a state"));
    }

    @Test
    void bankNumberIsEncryptedAndOnlyLastFourIsReturned() throws Exception {
        Vendor v = readyToSubmit();
        mvc.perform(get("/api/v1/vendors/me/application").header("Authorization", v.bearer()))
                .andExpect(jsonPath("$.bank.accountNumberLast4").value("6789"))
                .andExpect(jsonPath("$.bank.accountNumber").doesNotExist());
        String enc = jdbc.queryForObject("SELECT account_number_enc FROM marketplace.vendor_bank_account WHERE vendor_id = ?",
                String.class, v.vendorId());
        assertThat(enc).doesNotContain("50100123456789").contains(".");
        assertThat(crypto.decrypt(enc)).isEqualTo("50100123456789");
        // The legacy plaintext column is never written.
        assertThat(jdbc.queryForObject("SELECT \"accountNumber\" FROM \"Vendor\" WHERE id = ?", String.class, v.vendorId())).isNull();
    }

    @Test
    void documentsGoToThePrivateBucketAndAreCheckedByContent() throws Exception {
        Vendor v = register();
        verifyContacts(v);
        upload(v, "PAN_CARD", "MZ-not-a-pdf".getBytes(), "pan.pdf")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.PAN_CARD").value("Unsupported file type. Allowed: PDF, JPG, PNG"));
        upload(v, "AADHAAR", PDF, "a.pdf").andExpect(status().isBadRequest());

        upload(v, "PAN_CARD", PDF, "..\\..\\pan card.pdf").andExpect(status().isOk());
        var put = R2.last();
        assertThat(put.method()).isEqualTo("PUT");
        assertThat(put.path()).startsWith("/motoxplus-kyc/vendors/" + v.vendorId() + "/kyc/pan_card/").endsWith(".pdf");
        String fileUrl = jdbc.queryForObject("SELECT \"fileUrl\" FROM \"VendorDocument\" WHERE \"vendorId\" = ?", String.class, v.vendorId());
        assertThat(fileUrl).startsWith("r2-private://vendors/");
        assertThat(jdbc.queryForObject("SELECT \"fileName\" FROM \"VendorDocument\" WHERE \"vendorId\" = ?", String.class, v.vendorId()))
                .isEqualTo("pan card.pdf");

        // Replacing keeps exactly one current document of that type and deletes the old object.
        upload(v, "PAN_CARD", PDF, "pan2.pdf").andExpect(status().isOk());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM \"VendorDocument\" WHERE \"vendorId\" = ?", Integer.class, v.vendorId())).isEqualTo(1);
        assertThat(R2.last().method()).isEqualTo("DELETE");

        mvc.perform(delete("/api/v1/vendors/me/application/documents/PAN_CARD").header("Authorization", v.bearer()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.documents").isEmpty());
    }

    @Test
    void stateMovesToDocumentsPendingThenSubmitNeedsAllDeclarations() throws Exception {
        Vendor v = asReviewedApplicant(register());
        verifyContacts(v);
        putJson(v, "business", BUSINESS.replace("ABCDE1234F", "ABCDZ1234F")).andExpect(status().isOk());
        putJson(v, "categories", "{\"categoryIds\":[\"it-pads\",\"it-discs\"],\"vehicleSegments\":[\"PASSENGER_CAR\"]}")
                .andExpect(status().isOk())
                // both children selected -> collapsed to the group id
                .andExpect(jsonPath("$.categories.categoryIds[0]").value("it-brakes"));
        putJson(v, "bank", """
                {"accountHolder":"Someone Else","bankName":"SBI","accountNumber":"123456789012","ifsc":"SBIN0001234"}""")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.state").value("DOCUMENTS_PENDING"))
                .andExpect(jsonPath("$.missingDocuments.length()").value(3));

        mvc.perform(post("/api/v1/vendors/me/application/submit").header("Authorization", v.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content(DECLARATIONS))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.REQUIRED_DOCUMENTS").exists());

        upload(v, "PAN_CARD", PDF, "p.pdf").andExpect(status().isOk());
        upload(v, "GST_CERTIFICATE", PDF, "g.pdf").andExpect(status().isOk());
        upload(v, "CANCELLED_CHEQUE", PNG, "c.png").andExpect(status().isOk()).andExpect(jsonPath("$.state").value("DRAFT"));

        mvc.perform(post("/api/v1/vendors/me/application/submit").header("Authorization", v.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content(DECLARATIONS.replace("\"declareGenuineProducts\":true", "\"declareGenuineProducts\":false")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.declareGenuineProducts").exists());

        mvc.perform(post("/api/v1/vendors/me/application/submit").header("Authorization", v.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content(DECLARATIONS))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.state").value("UNDER_REVIEW"))
                .andExpect(jsonPath("$.editable").value(false));
        assertThat(jdbc.queryForObject("SELECT count(*) FROM marketplace.vendor_agreement_acceptance WHERE vendor_id = ?",
                Integer.class, v.vendorId())).isEqualTo(4);
        // Locked while under review; still not active.
        putJson(v, "bank", "{}").andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("APPLICATION_LOCKED"));
        assertThat(jdbc.queryForObject("SELECT status::text FROM \"Vendor\" WHERE id = ?", String.class, v.vendorId())).isEqualTo("PENDING");

        // The reviewer sees the account-holder mismatch as a warning.
        String admin = staff("ADMIN");
        JsonNode detail = read(mvc.perform(get("/api/v1/admin/vendor-applications/" + v.vendorId()).header("Authorization", admin))
                .andExpect(status().isOk()));
        boolean holderWarn = false;
        for (JsonNode c : detail.get("checks")) {
            if (c.get("code").asString().equals("ACCOUNT_HOLDER_NAME")) holderWarn = c.get("result").asString().equals("WARN");
        }
        assertThat(holderWarn).isTrue();
    }

    // ------------------------------------------------------------------ admin review

    @Test
    void reviewerRequestsChangesThenApprovesAndEveryStepIsInTheHistory() throws Exception {
        Vendor v = asReviewedApplicant(readyToSubmit());
        mvc.perform(post("/api/v1/vendors/me/application/submit").header("Authorization", v.bearer())
                .contentType(MediaType.APPLICATION_JSON).content(DECLARATIONS)).andExpect(status().isOk());
        String admin = staff("ADMIN");

        mvc.perform(get("/api/v1/admin/vendor-applications?state=UNDER_REVIEW&q=" + v.email()).header("Authorization", admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].vendorId").value(v.vendorId()));

        // Reason is mandatory for anything the vendor must act on.
        mvc.perform(post("/api/v1/admin/vendor-applications/" + v.vendorId() + "/request-changes").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/v1/admin/vendor-applications/" + v.vendorId() + "/request-changes").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"GST certificate is blurred, upload a clear copy\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.state").value("DRAFT"))
                .andExpect(jsonPath("$.decision.decision").value("CHANGES_REQUESTED"));

        // Vendor fixes and resubmits.
        upload(v, "GST_CERTIFICATE", PDF, "gst-clear.pdf").andExpect(status().isOk());
        mvc.perform(post("/api/v1/vendors/me/application/submit").header("Authorization", v.bearer())
                .contentType(MediaType.APPLICATION_JSON).content(DECLARATIONS)).andExpect(status().isOk());

        // Audited sensitive reads.
        String docId = jdbc.queryForObject("SELECT id FROM \"VendorDocument\" WHERE \"vendorId\" = ? AND \"documentType\" = 'PAN_CARD'",
                String.class, v.vendorId());
        mvc.perform(get("/api/v1/admin/vendor-applications/" + v.vendorId() + "/documents/" + docId + "/url").header("Authorization", admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.url").value(org.hamcrest.Matchers.containsString("/motoxplus-kyc/")))
                .andExpect(jsonPath("$.expiresIn").value(300));
        mvc.perform(get("/api/v1/admin/vendor-applications/" + v.vendorId() + "/bank-account").header("Authorization", admin))
                .andExpect(status().isOk()).andExpect(jsonPath("$.accountNumber").value("50100123456789"));

        mvc.perform(post("/api/v1/admin/vendor-applications/" + v.vendorId() + "/approve").header("Authorization", admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.state").value("ACTIVE"))
                .andExpect(jsonPath("$.vendorStatus").value("APPROVED"));
        mvc.perform(post("/api/v1/admin/vendor-applications/" + v.vendorId() + "/approve").header("Authorization", admin))
                .andExpect(status().isConflict());

        JsonNode detail = read(mvc.perform(get("/api/v1/admin/vendor-applications/" + v.vendorId()).header("Authorization", admin)));
        var actions = new java.util.ArrayList<String>();
        detail.get("history").forEach(h -> actions.add(h.get("action").asString()));
        assertThat(actions).contains("vendor.registered", "vendor.application.submitted", "vendor.application.changes_requested",
                "vendor.document.viewed", "vendor.bank.revealed", "vendor.application.approved");

        // Suspend needs a reason; reactivate restores access.
        mvc.perform(post("/api/v1/admin/vendor-applications/" + v.vendorId() + "/suspend").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"Counterfeit complaint under investigation\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.state").value("SUSPENDED"));
        mvc.perform(post("/api/v1/admin/vendor-applications/" + v.vendorId() + "/reactivate").header("Authorization", admin))
                .andExpect(status().isOk()).andExpect(jsonPath("$.state").value("ACTIVE"));
    }

    @Test
    void vendorsCannotSeeEachOthersDocumentsOrUseAdminEndpoints() throws Exception {
        Vendor a = readyToSubmit();
        Vendor b = register();
        String docOfA = jdbc.queryForObject("SELECT id FROM \"VendorDocument\" WHERE \"vendorId\" = ? LIMIT 1", String.class, a.vendorId());

        mvc.perform(get("/api/v1/vendors/me/application/documents/" + docOfA + "/url").header("Authorization", b.bearer()))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/vendors/me/application/documents/" + docOfA + "/url").header("Authorization", a.bearer()))
                .andExpect(status().isOk());

        mvc.perform(get("/api/v1/admin/vendor-applications").header("Authorization", a.bearer())).andExpect(status().isForbidden());
        // Support may look but not decide.
        String support = staff("SUPPORT");
        mvc.perform(get("/api/v1/admin/vendor-applications/" + a.vendorId()).header("Authorization", support)).andExpect(status().isOk());
        mvc.perform(post("/api/v1/admin/vendor-applications/" + a.vendorId() + "/approve").header("Authorization", support))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/admin/vendor-applications/" + a.vendorId() + "/bank-account").header("Authorization", support))
                .andExpect(status().isForbidden());
        // A dealer token can't act as a vendor.
        mvc.perform(get("/api/v1/vendors/me/application").header("Authorization", staff("DEALER"))).andExpect(status().isForbidden());
    }
}
