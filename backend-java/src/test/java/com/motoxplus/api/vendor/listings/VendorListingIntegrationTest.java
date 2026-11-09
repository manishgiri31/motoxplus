package com.motoxplus.api.vendor.listings;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.motoxplus.api.IntegrationTestBase;
import com.motoxplus.api.marketplace.commission.CommissionRates;
import com.motoxplus.api.security.JwtService;
import com.motoxplus.api.security.JwtService.AccessClaims;
import com.motoxplus.api.storage.FakeR2;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;
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

/**
 * Phase 4 vendor listings end to end: real PostgreSQL with Flyway V1..V4, an in-memory R2 (never the real bucket),
 * the real security chain, and the existing /api/search reading what publishing writes.
 */
class VendorListingIntegrationTest extends IntegrationTestBase {
    static final FakeR2 R2 = startR2();

    private static FakeR2 startR2() {
        try {
            return new FakeR2();
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
        r.add("app.r2.account-id", () -> "acct");
        r.add("app.r2.access-key-id", () -> "AKID");
        r.add("app.r2.secret-access-key", () -> "SECRET");
        r.add("app.r2.bucket", () -> "motoxplus-assets");
        r.add("app.r2.private-bucket", () -> "motoxplus-private");
        r.add("app.r2.public-url", () -> "https://pub.example.r2.dev");
        r.add("app.r2.endpoint", () -> R2.url());
    }

    @Autowired JwtService jwt;
    @Autowired CommissionRates commissionRates;
    private final JsonMapper json = JsonMapper.builder().build();

    static final byte[] JPEG = padded(new byte[] {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0}, 20_000);
    static final byte[] WEBP = padded(new byte[] {'R', 'I', 'F', 'F', 0x24, 0, 0, 0, 'W', 'E', 'B', 'P'}, 4_000);
    static final byte[] GIF = "GIF89a-not-allowed".getBytes();

    private static byte[] padded(byte[] head, int size) {
        byte[] b = Arrays.copyOf(head, size);
        for (int i = head.length; i < size; i++) b[i] = (byte) (i % 251);
        return b;
    }

    @BeforeEach
    void catalogue() {
        jdbc.update("""
                INSERT INTO "Category" (id, name, slug, "sortOrder", "isActive", "updatedAt") VALUES
                ('lt-brakes', 'LT Brake System', 'lt-brake-system', 1, true, now()),
                ('lt-engine', 'LT Engine', 'lt-engine', 2, true, now()) ON CONFLICT (id) DO NOTHING""");
        jdbc.update("""
                INSERT INTO "Category" (id, name, slug, "sortOrder", "isActive", "parentId", "updatedAt") VALUES
                ('lt-pads', 'LT Brake Pads', 'lt-brake-pads', 1, true, 'lt-brakes', now()),
                ('lt-discs', 'LT Brake Discs', 'lt-brake-discs', 2, true, 'lt-brakes', now()),
                ('lt-pistons', 'LT Pistons', 'lt-pistons', 1, true, 'lt-engine', now()) ON CONFLICT (id) DO NOTHING""");
        jdbc.update("""
                INSERT INTO "VehicleManufacturer" (id, name, slug, "updatedAt") VALUES ('lt-hero', 'LT Hero', 'lt-hero', now())
                ON CONFLICT (id) DO NOTHING""");
        jdbc.update("""
                INSERT INTO "Vehicle" (id, name, slug, category, "manufacturerId", "isActive", "updatedAt") VALUES
                ('lt-veh-splendor', 'LT Splendor Plus', 'lt-splendor-plus', 'MOTORCYCLE', 'lt-hero', true, now()),
                ('lt-veh-retired', 'LT Retired Model', 'lt-retired-model', 'MOTORCYCLE', 'lt-hero', false, now())
                ON CONFLICT (id) DO NOTHING""");
    }

    // ------------------------------------------------------------------ helpers

    record Seller(String userId, String vendorId, String vendorCode, String bearer) {}

    private Seller seller(String vendorStatus) {
        String n = UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        String uid = "u-lt-" + n;
        String vid = "v-lt-" + n;
        String code = "VND" + String.format("%08d", ThreadLocalRandom.current().nextInt(100_000_000));
        String email = "seller-" + n + "@example.test";
        jdbc.update("""
                INSERT INTO "User" (id, name, email, password, role, "emailVerified", "mobileVerified", "mobileNumber", "isActive", "updatedAt")
                VALUES (?, 'Ravi Kumar', ?, 'x', 'VENDOR', now(), true, ?, true, now())""", uid, email, "+9198" + n.hashCode());
        jdbc.update("""
                INSERT INTO "Vendor" (id, "userId", "vendorCode", "companyName", "ownerName", email, phone, city, state, status, "updatedAt")
                VALUES (?, ?, ?, 'Kumar Auto Components', 'Ravi Kumar', ?, '9876543210', 'New Delhi', 'Delhi', ?::"VendorStatus", now())""",
                vid, uid, code, email, vendorStatus);
        // Approved for the whole brake group (so both brake subcategories), not the engine group.
        jdbc.update("INSERT INTO \"VendorPartCategory\" (\"vendorId\", \"categoryId\", \"createdAt\") VALUES (?, 'lt-brakes', now())", vid);
        return new Seller(uid, vid, code, bearerFor(uid, email, "VENDOR"));
    }

    private String bearerFor(String userId, String email, String role) {
        String sid = "s-" + UUID.randomUUID();
        jdbc.update("""
                INSERT INTO "UserSession" (id, "userId", "refreshToken", "expiresAt") VALUES (?, ?, ?, now() + interval '7 days')""",
                sid, userId, "r-" + sid);
        return "Bearer " + jwt.signAccessToken(new AccessClaims(userId, email, role, sid));
    }

    private String staff(String role) {
        String uid = "u-staff-" + UUID.randomUUID();
        jdbc.update("INSERT INTO \"User\" (id, name, email, password, \"updatedAt\") VALUES (?, 'Staff', ?, 'x', now())", uid, uid + "@x.test");
        return bearerFor(uid, uid + "@x.test", role);
    }

    private static String token() {
        StringBuilder s = new StringBuilder("zq");
        for (int i = 0; i < 6; i++) s.append((char) ('a' + ThreadLocalRandom.current().nextInt(26)));
        return s.toString();
    }

    /** A complete listing body; {@code word} makes the title unique so search can find exactly this listing. */
    private static String full(String word, String partNumber, String sku) {
        return """
                {"title":"Front brake pad set %s","description":"Sintered pads for daily commuting.","brand":"Kumar Friction",
                 "categoryId":"lt-pads","partNumber":"%s","sku":"%s","hsnCode":"8714","gstRate":18,"moq":1,"stock":25,
                 "warranty":"6 months","countryOfOrigin":"India","weightGrams":250,"mrp":499,"retailPrice":449,"dealerPrice":320,
                 "fitment":[{"vehicleId":"lt-veh-splendor","yearFrom":2015,"yearTo":2024}]}""".formatted(word, partNumber, sku);
    }

    private JsonNode read(ResultActions r) throws Exception {
        return json.readTree(r.andReturn().getResponse().getContentAsString());
    }

    private ResultActions create(Seller s, String body) throws Exception {
        return mvc.perform(post("/api/v1/vendors/me/listings").header("Authorization", s.bearer())
                .contentType(MediaType.APPLICATION_JSON).content(body));
    }

    private ResultActions update(Seller s, String id, String body) throws Exception {
        return mvc.perform(put("/api/v1/vendors/me/listings/" + id).header("Authorization", s.bearer())
                .contentType(MediaType.APPLICATION_JSON).content(body));
    }

    private ResultActions action(Seller s, String id, String action) throws Exception {
        return mvc.perform(post("/api/v1/vendors/me/listings/" + id + "/" + action).header("Authorization", s.bearer()));
    }

    private ResultActions upload(Seller s, String id, byte[] bytes, String name, String type) throws Exception {
        return mvc.perform(multipart("/api/v1/vendors/me/listings/" + id + "/images")
                .file(new MockMultipartFile("file", name, type, bytes)).header("Authorization", s.bearer()));
    }

    private ResultActions search(String q) throws Exception {
        return mvc.perform(get("/api/search").param("q", q).param("type", "products")
                .header("X-Real-IP", "10.9." + ThreadLocalRandom.current().nextInt(250) + "." + ThreadLocalRandom.current().nextInt(250)));
    }

    /** Draft with one photo, ready to publish. Returns the listing id. */
    private String readyListing(Seller s, String word) throws Exception {
        String id = read(create(s, full(word, "PN-" + word.toUpperCase(), "SKU-" + word)).andExpect(status().isCreated())).get("id").asString();
        upload(s, id, JPEG, "pad.jpg", "image/jpeg").andExpect(status().isOk());
        return id;
    }

    private List<String> auditActions(String listingId) {
        return jdbc.queryForList("SELECT action FROM marketplace.audit_log WHERE entity_type = 'listing' AND entity_id = ? ORDER BY occurred_at, id",
                String.class, listingId);
    }

    private Map<String, Object> product(String listingId) {
        return jdbc.queryForMap("""
                SELECT p.* FROM public."Product" p JOIN marketplace.vendor_listing l ON l.product_id = p.id WHERE l.id = ?""", listingId);
    }

    // ------------------------------------------------------------------ ownership and access

    @Test
    void aListingBelongsToTheLoggedInVendorWhateverTheBodySays() throws Exception {
        Seller a = seller("APPROVED");
        Seller b = seller("APPROVED");
        String body = """
                {"title":"Disc rotor","vendorId":"%s","status":"LIVE","productId":"p-forged","userId":"%s"}""".formatted(b.vendorId(), b.userId());
        JsonNode created = read(create(a, body).andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("DRAFT"))
                .andExpect(jsonPath("$.storefront.visible").value(false)));
        String id = created.get("id").asString();

        assertThat(jdbc.queryForObject("SELECT vendor_id FROM marketplace.vendor_listing WHERE id = ?", String.class, id)).isEqualTo(a.vendorId());
        assertThat(jdbc.queryForObject("SELECT product_id FROM marketplace.vendor_listing WHERE id = ?", String.class, id)).isNull();
        assertThat(jdbc.queryForObject("SELECT created_by FROM marketplace.vendor_listing WHERE id = ?", String.class, id)).isEqualTo(a.userId());
        assertThat(jdbc.queryForObject("""
                SELECT vendor_id FROM marketplace.audit_log WHERE action = 'vendor.listing.created' AND entity_id = ?""", String.class, id))
                .isEqualTo(a.vendorId());
    }

    @Test
    void anotherVendorGets404ForEverythingAboutSomeoneElsesListing() throws Exception {
        Seller owner = seller("APPROVED");
        Seller other = seller("APPROVED");
        String id = readyListing(owner, token());
        String imageId = read(mvc.perform(get("/api/v1/vendors/me/listings/" + id).header("Authorization", owner.bearer())))
                .get("images").get(0).get("id").asString();

        mvc.perform(get("/api/v1/vendors/me/listings/" + id).header("Authorization", other.bearer())).andExpect(status().isNotFound());
        update(other, id, full("x", "PN-X", "SKU-X")).andExpect(status().isNotFound());
        action(other, id, "publish").andExpect(status().isNotFound());
        action(other, id, "unpublish").andExpect(status().isNotFound());
        upload(other, id, JPEG, "x.jpg", "image/jpeg").andExpect(status().isNotFound());
        mvc.perform(delete("/api/v1/vendors/me/listings/" + id + "/images/" + imageId).header("Authorization", other.bearer()))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/vendors/me/listings/" + id + "/images/" + imageId).header("Authorization", other.bearer()))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/vendors/me/listings").header("Authorization", other.bearer()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.total").value(0));

        // Nothing changed for the owner.
        mvc.perform(get("/api/v1/vendors/me/listings/" + id).header("Authorization", owner.bearer()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("DRAFT")).andExpect(jsonPath("$.images.length()").value(1));
    }

    @Test
    void onlyApprovedVendorsCanUseListings() throws Exception {
        mvc.perform(get("/api/v1/vendors/me/listings")).andExpect(status().isUnauthorized());

        Seller pending = seller("PENDING");
        create(pending, "{\"title\":\"Brake shoe\"}").andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("VENDOR_NOT_ACTIVE"));
        Seller suspended = seller("SUSPENDED");
        mvc.perform(get("/api/v1/vendors/me/listings").header("Authorization", suspended.bearer()))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("VENDOR_NOT_ACTIVE"));

        String dealer = staff("DEALER");
        mvc.perform(post("/api/v1/vendors/me/listings").header("Authorization", dealer).contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"Brake shoe\"}")).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("NOT_A_VENDOR"));
        String admin = staff("ADMIN");
        mvc.perform(get("/api/v1/vendors/me/listings").header("Authorization", admin)).andExpect(status().isForbidden());
    }

    // ------------------------------------------------------------------ validation

    @Test
    void pricesMustRunMrpThenRetailThenDealerAndBeAboveZero() throws Exception {
        Seller s = seller("APPROVED");
        String base = full(token(), "PN-" + token(), "SKU-" + token());

        create(s, base.replace("\"retailPrice\":449", "\"retailPrice\":550")).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.fieldErrors.retailPrice").value("Retail price can't be higher than the MRP"));
        create(s, base.replace("\"dealerPrice\":320", "\"dealerPrice\":460")).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.dealerPrice").value("Dealer price can't be higher than the retail price"));
        create(s, base.replace("\"mrp\":499", "\"mrp\":0")).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.mrp").value("MRP must be more than ₹0"));
        create(s, base.replace("\"dealerPrice\":320", "\"dealerPrice\":-5")).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.dealerPrice").exists());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM marketplace.vendor_listing WHERE vendor_id = ?", Integer.class, s.vendorId())).isZero();

        // The database enforces the same ordering even if code were bypassed.
        String id = read(create(s, base).andExpect(status().isCreated())).get("id").asString();
        assertThatThrownBy(() -> jdbc.update("UPDATE marketplace.vendor_listing SET retail_price_paise = mrp_paise + 1 WHERE id = ?", id))
                .hasMessageContaining("vendor_listing_mrp_ge_retail");
        assertThatThrownBy(() -> jdbc.update("UPDATE marketplace.vendor_listing SET dealer_price_paise = 0 WHERE id = ?", id))
                .hasMessageContaining("dealer_price_paise");
    }

    @Test
    void categoriesSkusAndVehiclesAreCheckedAgainstTheVendorAndCatalogue() throws Exception {
        Seller s = seller("APPROVED");
        String word = token();
        String body = full(word, "PN-" + word, "SKU-" + word);

        JsonNode overview = read(mvc.perform(get("/api/v1/vendors/me/listings/overview").header("Authorization", s.bearer()))
                .andExpect(status().isOk()));
        List<String> groups = new java.util.ArrayList<>();
        for (JsonNode g : overview.get("categories")) groups.add(g.get("id").asString());
        assertThat(groups).contains("lt-brakes").doesNotContain("lt-engine");

        create(s, body.replace("lt-pads", "lt-pistons")).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.categoryId").value("Choose one of the categories approved for your account"));
        create(s, body.replace("lt-veh-splendor", "lt-veh-retired")).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.fitment").exists());

        create(s, body).andExpect(status().isCreated());
        create(s, body.replace("Front brake", "Rear brake")).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.sku").value("You already use this SKU on another listing"));
        // A different vendor may use the same SKU (SKUs are per vendor).
        create(seller("APPROVED"), body).andExpect(status().isCreated());

        mvc.perform(get("/api/v1/vendors/me/listings/vehicles").param("q", "lt splen").header("Authorization", s.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value("lt-veh-splendor"))
                .andExpect(jsonPath("$.length()").value(1));
    }

    // ------------------------------------------------------------------ publish on valid

    @Test
    void publishingIsRefusedUntilTheListingIsCompleteAndSaysWhatIsMissing() throws Exception {
        Seller s = seller("APPROVED");
        String id = read(create(s, "{\"title\":\"Clutch cable\"}").andExpect(status().isCreated())
                .andExpect(jsonPath("$.readiness.ready").value(false))).get("id").asString();

        action(s, id, "publish").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("LISTING_INCOMPLETE"))
                .andExpect(jsonPath("$.error").value("10 things to finish before this listing can go live"))
                .andExpect(jsonPath("$.fieldErrors.categoryId").exists())
                .andExpect(jsonPath("$.fieldErrors.brand").exists())
                .andExpect(jsonPath("$.fieldErrors.partNumber").exists())
                .andExpect(jsonPath("$.fieldErrors.sku").exists())
                .andExpect(jsonPath("$.fieldErrors.images").value("Add at least one photo"))
                .andExpect(jsonPath("$.fieldErrors.mrp").exists())
                .andExpect(jsonPath("$.fieldErrors.retailPrice").exists())
                .andExpect(jsonPath("$.fieldErrors.dealerPrice").exists())
                .andExpect(jsonPath("$.fieldErrors.stock").exists())
                .andExpect(jsonPath("$.fieldErrors.hsnCode").exists());

        // Everything but a photo: still refused, for exactly that reason.
        String word = token();
        update(s, id, full(word, "PN-" + word, "SKU-" + word)).andExpect(status().isOk());
        action(s, id, "publish").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Add at least one photo"));

        assertThat(jdbc.queryForObject("SELECT status FROM marketplace.vendor_listing WHERE id = ?", String.class, id)).isEqualTo("DRAFT");
        assertThat(jdbc.queryForObject("SELECT product_id FROM marketplace.vendor_listing WHERE id = ?", String.class, id)).isNull();
        assertThat(auditActions(id)).containsExactly("vendor.listing.created", "vendor.listing.updated");
    }

    @Test
    void aCompleteListingGoesLiveOnPublishWithoutReviewAndAppearsInSearch() throws Exception {
        Seller s = seller("APPROVED");
        String word = token();
        String id = readyListing(s, word);
        mvc.perform(get("/api/v1/vendors/me/listings/" + id).header("Authorization", s.bearer()))
                .andExpect(jsonPath("$.readiness.ready").value(true));
        search(word).andExpect(jsonPath("$.groups.length()").value(0)); // drafts are never searchable

        JsonNode live = read(action(s, id, "publish").andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("LIVE"))
                .andExpect(jsonPath("$.storefront.visible").value(true)));
        String url = live.get("storefront").get("url").asString();
        String imageId = live.get("images").get(0).get("id").asString();
        assertThat(url).isEqualTo("/products/front-brake-pad-set-" + word);

        Map<String, Object> p = product(id);
        assertThat(p.get("isActive")).isEqualTo(true);
        assertThat(p.get("source").toString()).isEqualTo("VENDOR");
        assertThat(p.get("vendorId")).isEqualTo(s.vendorId());
        assertThat(((Number) p.get("price")).intValue()).isEqualTo(320); // dealer price
        assertThat(((Number) p.get("mrp")).doubleValue()).isEqualTo(499.0);
        assertThat(p.get("partNumber")).isEqualTo("PN-" + word.toUpperCase());
        assertThat(p.get("sku")).isEqualTo(s.vendorCode() + "-SKU-" + word);
        assertThat(p.get("hsnCode")).isEqualTo("8714");
        assertThat(jdbc.queryForObject("SELECT \"imageUrl\" FROM \"ProductImage\" WHERE \"productId\" = ? AND \"isPrimary\"", String.class, p.get("id")))
                .isEqualTo("/api/v1/listing-images/" + imageId);
        // Seller fitment is recorded as unverified, never as confirmed compatibility.
        assertThat(jdbc.queryForMap("SELECT confidence::text AS c, source::text AS s FROM \"ProductCompatibility\" WHERE \"productId\" = ?", p.get("id")))
                .containsEntry("c", "UNVERIFIED").containsEntry("s", "IMPORTED");
        assertThat((String[]) jdbc.queryForObject("SELECT compatibility FROM \"Product\" WHERE id = ?",
                (rs, i) -> (String[]) rs.getArray(1).getArray(), p.get("id"))).isEmpty();

        // The existing search finds it, with the photo served from our own origin.
        search(word).andExpect(status().isOk())
                .andExpect(jsonPath("$.groups[0].type").value("products"))
                .andExpect(jsonPath("$.groups[0].items[0].url").value(url))
                .andExpect(jsonPath("$.groups[0].items[0].image").value("/api/v1/listing-images/" + imageId));
        mvc.perform(get("/api/v1/listing-images/" + imageId))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", "image/jpeg"))
                .andExpect(header().string("Cache-Control", org.hamcrest.Matchers.containsString("public")))
                .andExpect(content().bytes(JPEG));

        assertThat(auditActions(id)).containsExactly("vendor.listing.created", "vendor.listing.image_added", "vendor.listing.published");
        // Publishing again is a no-op, not a second audit entry.
        action(s, id, "publish").andExpect(status().isOk());
        assertThat(auditActions(id)).hasSize(3);
    }

    @Test
    void unpublishTakesItOffTheStorefrontAndRepublishingReusesTheSameProduct() throws Exception {
        Seller s = seller("APPROVED");
        String word = token();
        String id = readyListing(s, word);
        JsonNode live = read(action(s, id, "publish").andExpect(status().isOk()));
        String imageId = live.get("images").get(0).get("id").asString();
        Object productId = product(id).get("id");

        action(s, id, "unpublish").andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UNPUBLISHED"))
                .andExpect(jsonPath("$.storefront.visible").value(false));
        assertThat(product(id).get("isActive")).isEqualTo(false);
        search(word).andExpect(jsonPath("$.groups.length()").value(0));
        mvc.perform(get("/api/v1/listing-images/" + imageId)).andExpect(status().isNotFound());
        action(s, id, "unpublish").andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("NOT_LIVE"));

        action(s, id, "publish").andExpect(status().isOk()).andExpect(jsonPath("$.storefront.url").value(live.get("storefront").get("url").asString()));
        assertThat(product(id).get("id")).isEqualTo(productId);
        assertThat(product(id).get("isActive")).isEqualTo(true);
        assertThat(auditActions(id)).endsWith("vendor.listing.published", "vendor.listing.unpublished", "vendor.listing.published");
    }

    @Test
    void editingALiveListingMustKeepItCompleteAndUpdatesTheStorefrontAtOnce() throws Exception {
        Seller s = seller("APPROVED");
        String word = token();
        String id = readyListing(s, word);
        JsonNode live = read(action(s, id, "publish").andExpect(status().isOk()));
        String body = full(word, "PN-" + word.toUpperCase(), "SKU-" + word);

        update(s, id, body.replace("\"stock\":25", "\"stock\":0")).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("This listing is live, so every required detail must stay filled in"))
                .andExpect(jsonPath("$.fieldErrors.stock").value("Add at least 1 unit of stock"));
        update(s, id, body.replace("\"brand\":\"Kumar Friction\",", "")).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.brand").value("Add the brand"));
        assertThat(((Number) product(id).get("stock")).intValue()).isEqualTo(25);

        update(s, id, body.replace("\"dealerPrice\":320", "\"dealerPrice\":299").replace("Front brake", "Front disc brake"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("LIVE")).andExpect(jsonPath("$.dealerPrice").value(299));
        Map<String, Object> p = product(id);
        assertThat(((Number) p.get("price")).intValue()).isEqualTo(299);
        assertThat(p.get("name")).isEqualTo("Front disc brake pad set " + word);
        assertThat(p.get("slug")).as("the URL survives a title change").isEqualTo("front-brake-pad-set-" + word);

        String details = jdbc.queryForObject("""
                SELECT details::text FROM marketplace.audit_log WHERE action = 'vendor.listing.updated' AND entity_id = ?""", String.class, id);
        assertThat(details).contains("\"dealerPrice\"").contains("\"from\": 320").contains("\"to\": 299").contains("\"live\": true");

        String onlyPhoto = live.get("images").get(0).get("id").asString();
        mvc.perform(delete("/api/v1/vendors/me/listings/" + id + "/images/" + onlyPhoto).header("Authorization", s.bearer()))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("LAST_PHOTO"));
    }

    @Test
    void aPartNumberAlreadyInTheCatalogueGetsAVendorSuffixSoBothStayListed() throws Exception {
        String pn = "OEM-" + token().toUpperCase();
        jdbc.update("""
                INSERT INTO "Product" (id, name, sku, "partNumber", "categoryId", price, "updatedAt", slug)
                VALUES (?, 'House brand pad', ?, ?, 'lt-pads', 300, now(), ?)""", "p-" + pn, "MX-" + pn, pn, "house-" + pn.toLowerCase());
        Seller s = seller("APPROVED");
        String word = token();
        String id = read(create(s, full(word, pn, "SKU-" + word)).andExpect(status().isCreated())).get("id").asString();
        upload(s, id, JPEG, "pad.jpg", "image/jpeg").andExpect(status().isOk());
        action(s, id, "publish").andExpect(status().isOk());
        assertThat(product(id).get("partNumber")).isEqualTo(pn + "-" + s.vendorCode());
    }

    // ------------------------------------------------------------------ photos

    @Test
    void photosAreCheckedByTheirBytesAndSizeAndKeptInThePrivateBucket() throws Exception {
        Seller s = seller("APPROVED");
        String id = read(create(s, "{\"title\":\"Brake lever\"}").andExpect(status().isCreated())).get("id").asString();

        // A GIF that claims to be a JPEG is refused; so is anything over 5 MB.
        upload(s, id, GIF, "lever.jpg", "image/jpeg").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.images").value("Use a JPG, PNG or WEBP photo"));
        upload(s, id, padded(new byte[] {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF}, (int) ListingRules.MAX_IMAGE_BYTES + 1), "big.jpg", "image/jpeg")
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.fieldErrors.images").value("Photo is too large (max 5 MB)"));

        // A real WEBP is accepted even when the browser labels it generically.
        JsonNode after = read(upload(s, id, WEBP, "lever.webp", "application/octet-stream").andExpect(status().isOk()));
        String imageId = after.get("images").get(0).get("id").asString();
        assertThat(after.get("images").get(0).get("mimeType").asString()).isEqualTo("image/webp");
        assertThat(after.get("images").get(0).get("url").asString()).isEqualTo("/api/v1/vendors/me/listings/" + id + "/images/" + imageId);

        Map<String, Object> row = jdbc.queryForMap("SELECT object_key, stored_url, sha256 FROM marketplace.vendor_listing_image WHERE id = ?", imageId);
        String key = (String) row.get("object_key");
        assertThat(key).startsWith("vendors/" + s.vendorId() + "/listings/" + id + "/").endsWith(".webp");
        assertThat(row.get("stored_url")).isEqualTo("r2-private://" + key);
        assertThat(R2.objects).containsKey("/motoxplus-private/" + key);
        assertThat(R2.objects.get("/motoxplus-private/" + key)).isEqualTo(WEBP);

        // The owner sees the draft's photo; the public does not.
        mvc.perform(get("/api/v1/vendors/me/listings/" + id + "/images/" + imageId).header("Authorization", s.bearer()))
                .andExpect(status().isOk()).andExpect(header().string("Content-Type", "image/webp")).andExpect(content().bytes(WEBP));
        mvc.perform(get("/api/v1/listing-images/" + imageId)).andExpect(status().isNotFound());

        // Up to 8 photos; the 9th is refused. Make the last one primary.
        String last = imageId;
        for (int i = 1; i < ListingRules.MAX_IMAGES; i++) {
            last = read(upload(s, id, JPEG, "p" + i + ".jpg", "image/jpeg").andExpect(status().isOk())).get("images").get(i).get("id").asString();
        }
        upload(s, id, JPEG, "p9.jpg", "image/jpeg").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.images").value("You can add up to 8 photos"));
        mvc.perform(post("/api/v1/vendors/me/listings/" + id + "/images/" + last + "/primary").header("Authorization", s.bearer()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.images[0].id").value(last)).andExpect(jsonPath("$.images[0].primary").value(true));

        // Removing a photo deletes the object too.
        mvc.perform(delete("/api/v1/vendors/me/listings/" + id + "/images/" + imageId).header("Authorization", s.bearer()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.images.length()").value(ListingRules.MAX_IMAGES - 1));
        assertThat(R2.objects).doesNotContainKey("/motoxplus-private/" + key);
    }

    // ------------------------------------------------------------------ vendor status and commission

    @Test
    void suspendingAVendorHidesTheirLiveListingsAndReactivatingRestoresThem() throws Exception {
        Seller s = seller("APPROVED");
        String word = token();
        String id = readyListing(s, word);
        action(s, id, "publish").andExpect(status().isOk());
        String admin = staff("ADMIN");

        mvc.perform(post("/api/v1/admin/vendor-applications/" + s.vendorId() + "/suspend").header("Authorization", admin)
                .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"Customer complaints under review\"}")).andExpect(status().isOk());
        assertThat(product(id).get("isActive")).isEqualTo(false);
        search(word).andExpect(jsonPath("$.groups.length()").value(0));
        assertThat(jdbc.queryForObject("SELECT status FROM marketplace.vendor_listing WHERE id = ?", String.class, id))
                .as("the vendor's intent is kept").isEqualTo("LIVE");

        mvc.perform(post("/api/v1/admin/vendor-applications/" + s.vendorId() + "/reactivate").header("Authorization", admin)
                .contentType(MediaType.APPLICATION_JSON).content("{}")).andExpect(status().isOk());
        assertThat(product(id).get("isActive")).isEqualTo(true);
        search(word).andExpect(jsonPath("$.groups[0].items.length()").value(1));
    }

    @Test
    void theCommissionRulesAreConfigurationNotCode() throws Exception {
        Seller s = seller("APPROVED");
        mvc.perform(get("/api/v1/vendors/me/listings/overview").header("Authorization", s.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.commission.saleCommissionBp").value(1500))
                .andExpect(jsonPath("$.limits.maxImages").value(8))
                .andExpect(jsonPath("$.counts.ALL").value(0));

        CommissionRates.Rules rules = commissionRates.current();
        assertThat(rules.id()).isEqualTo("commission-launch");
        assertThat(rules.saleCommissionBp()).isEqualTo(1500);
        assertThat(rules.settlesOn()).isEqualTo(CommissionRates.SettlesOn.DELIVERED_AND_PAID);
        assertThat(rules.codAdvanceBp()).isEqualTo(2000);
        assertThat(rules.codAdvanceOnCancel()).isEqualTo(CommissionRates.CodAdvanceOnCancel.TO_MOTOXPLUS);
        assertThat(rules.returnDeductionBp()).isEqualTo(2000);
        assertThat(rules.returnShippingPaidFrom()).isEqualTo(CommissionRates.ReturnShippingPaidFrom.RETURN_DEDUCTION);
        // The vendor pays nothing on returns: the 5% vendor return fee is gone, only the customer-side deduction remains.
        assertThat(jdbc.queryForList("""
                SELECT column_name FROM information_schema.columns WHERE table_schema = 'marketplace' AND table_name = 'commission_rate'""",
                String.class)).doesNotContain("return_fee_bp").contains("return_deduction_bp");

        // A future rule set is stored but not yet in force; past ones can't be rewritten; behaviour settlement isn't built
        // for is refused by the database.
        String insert = """
                INSERT INTO marketplace.commission_rate (id, sale_commission_bp, settles_on, cod_advance_bp, cod_advance_on_cancel,
                    return_deduction_bp, return_shipping_paid_from, effective_from)
                VALUES (?, 1200, 'DELIVERED_AND_PAID', 2000, ?, 2000, 'RETURN_DEDUCTION', now() + interval '30 days')
                ON CONFLICT (id) DO NOTHING""";
        jdbc.update(insert, "future-test", "TO_MOTOXPLUS");
        mvc.perform(get("/api/v1/vendors/me/listings/overview").header("Authorization", s.bearer()))
                .andExpect(jsonPath("$.commission.saleCommissionBp").value(1500));
        assertThat(commissionRates.current().id()).isEqualTo("commission-launch");
        assertThatThrownBy(() -> jdbc.update("UPDATE marketplace.commission_rate SET sale_commission_bp = 0 WHERE id = 'commission-launch'"))
                .hasMessageContaining("append-only");
        assertThatThrownBy(() -> jdbc.update(insert, "unsupported-test", "TO_VENDOR"))
                .hasMessageContaining("cod_advance_on_cancel");
    }
}
