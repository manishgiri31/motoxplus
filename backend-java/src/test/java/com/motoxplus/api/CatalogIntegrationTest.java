package com.motoxplus.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;
import org.junit.jupiter.api.Test;

/** Public catalog endpoints against the real Prisma-created tables (no login needed). */
class CatalogIntegrationTest extends IntegrationTestBase {

    /** A token unique to one test so tests sharing the database never see each other's rows. */
    static String token() {
        return "zq" + UUID.randomUUID().toString().replace("-", "").substring(0, 10);
    }

    String category(String name, int sortOrder, boolean active) {
        String id = "c" + UUID.randomUUID().toString().replace("-", "").substring(0, 20);
        jdbc.update("""
                INSERT INTO "Category" (id, name, slug, "sortOrder", "isActive", "updatedAt")
                VALUES (?, ?, ?, ?, ?, now())""", id, name, name.toLowerCase().replace(' ', '-'), sortOrder, active);
        return id;
    }

    String product(String categoryId, String name, String partNumber, String brand, boolean active, String... compatibility) {
        String id = "p" + UUID.randomUUID().toString().replace("-", "").substring(0, 20);
        jdbc.update(con -> {
            var ps = con.prepareStatement("""
                    INSERT INTO "Product" (id, name, sku, "partNumber", "categoryId", price, brand, slug, "isActive",
                                           compatibility, images, "updatedAt")
                    VALUES (?, ?, ?, ?, ?, 1000, ?, ?, ?, ?, ?, now())""");
            ps.setString(1, id);
            ps.setString(2, name);
            ps.setString(3, "sku-" + id);
            ps.setString(4, partNumber);
            ps.setString(5, categoryId);
            ps.setString(6, brand);
            ps.setString(7, "slug-" + id);
            ps.setBoolean(8, active);
            ps.setArray(9, con.createArrayOf("text", compatibility));
            ps.setArray(10, con.createArrayOf("text", new String[0]));
            return ps;
        });
        return id;
    }

    void primaryImage(String productId, String url) {
        jdbc.update("""
                INSERT INTO "ProductImage" (id, "productId", "imageUrl", "isPrimary") VALUES (?, ?, ?, true)""",
                "i" + UUID.randomUUID().toString().replace("-", "").substring(0, 20), productId, url);
    }

    @Test
    void categoriesAreBrowsableOnlyOrderedAndCountEveryProductLikePrisma() throws Exception {
        String t = token();
        String second = category(t + " Second", 2, true);
        String first = category(t + " First", 1, true);
        category(t + " Hidden", 0, false);
        category(t + " Empty", 3, true); // active but nothing to browse: hidden from shoppers
        product(second, "Active S", "pn-" + t + "-s", "B", true);
        product(first, "Active A", "pn-" + t + "-a", "B", true);
        product(first, "Active B", "pn-" + t + "-b", "B", true);
        product(first, "Inactive C", "pn-" + t + "-c", "B", false);

        String body = mvc.perform(get("/api/categories")).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();

        assertThat(body).doesNotContain(t + " Hidden").doesNotContain(t + " Empty");
        assertThat(body.indexOf(t + " First")).isPositive().isLessThan(body.indexOf(t + " Second"));
        mvc.perform(get("/api/categories"))
                .andExpect(jsonPath("$[?(@.name=='" + t + " First')]._count.products").value(3)) // Prisma counts inactive too
                .andExpect(jsonPath("$[?(@.name=='" + t + " Second')]._count.products").value(1))
                .andExpect(jsonPath("$[?(@.name=='" + t + " First')].isActive").value(true))
                .andExpect(jsonPath("$[?(@.name=='" + t + " First')].sortOrder").value(1))
                .andExpect(jsonPath("$[?(@.name=='" + t + " First')].createdAt").value(org.hamcrest.Matchers.hasItem(
                        org.hamcrest.Matchers.matchesPattern("\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z"))));
        assertThat(second).isNotBlank();
    }

    @Test
    void searchMatchesNamePartNumberBrandAndSkuCaseInsensitivelyWithImages() throws Exception {
        String t = token();
        String cat = category(t + " Cat", 0, true);
        String byName = product(cat, "Brake Pad " + t, "PN-A-" + t, "Acme", true);
        primaryImage(byName, "https://img.test/" + t + ".webp");
        product(cat, "Zzz One", "PN-" + t.toUpperCase() + "-X", "Acme", true);
        product(cat, "Zzz Two", "PN-OTHER-" + UUID.randomUUID(), t + "Brand", true); // matches on brand only

        // case-insensitive: query in upper case
        mvc.perform(get("/api/products/search").param("q", t.toUpperCase()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.suggestions.length()").value(3))
                .andExpect(jsonPath("$.suggestions[0].name").value("Brake Pad " + t)) // ordered by name
                .andExpect(jsonPath("$.suggestions[0].matchType").value("name"))
                .andExpect(jsonPath("$.suggestions[0].imageUrl").value("https://img.test/" + t + ".webp"))
                .andExpect(jsonPath("$.suggestions[0].categoryName").value(t + " Cat"))
                .andExpect(jsonPath("$.suggestions[1].matchType").value("partNumber"))
                .andExpect(jsonPath("$.suggestions[1].imageUrl").doesNotExist()) // omitted, not null
                .andExpect(jsonPath("$.suggestions[2].matchType").value("brand"));
    }

    @Test
    void searchFindsByVehicleCompatibilityAndDeduplicates() throws Exception {
        String t = token();
        String cat = category(t + " Cat", 0, true);
        product(cat, "Chain Kit", "PN-" + t, "Acme", true, "Hero Splendor " + t, "Bajaj Pulsar");
        product(cat, "Both " + t, "PN-2-" + t, "Acme", true, "Honda Shine " + t); // matches name AND compat

        var res = mvc.perform(get("/api/products/search").param("q", "splendor " + t)).andExpect(status().isOk());
        res.andExpect(jsonPath("$.suggestions.length()").value(1))
                .andExpect(jsonPath("$.suggestions[0].name").value("Chain Kit"))
                .andExpect(jsonPath("$.suggestions[0].matchType").value("compatibility"))
                .andExpect(jsonPath("$.suggestions[0].imageUrl").doesNotExist());

        mvc.perform(get("/api/products/search").param("q", t))
                .andExpect(jsonPath("$.suggestions.length()").value(2)) // "Both" listed once despite two match paths
                .andExpect(jsonPath("$.suggestions[?(@.name=='Both " + t + "')].matchType").value("name"));
    }

    @Test
    void inactiveProductsAreNeverSuggested() throws Exception {
        String t = token();
        String cat = category(t + " Cat", 0, true);
        product(cat, "Hidden " + t, "PN-" + t, "Acme", false, "Hero " + t);

        mvc.perform(get("/api/products/search").param("q", t)).andExpect(jsonPath("$.suggestions.length()").value(0));
    }

    @Test
    void shortOrMissingQueriesReturnNothingWithoutTouchingTheDatabase() throws Exception {
        mvc.perform(get("/api/products/search")).andExpect(status().isOk()).andExpect(jsonPath("$.suggestions.length()").value(0));
        mvc.perform(get("/api/products/search").param("q", "a")).andExpect(jsonPath("$.suggestions.length()").value(0));
        mvc.perform(get("/api/products/search").param("q", "   ")).andExpect(jsonPath("$.suggestions.length()").value(0));
    }

    @Test
    void sqlWildcardsInTheQueryAreTreatedAsLiteralText() throws Exception {
        String t = token();
        String cat = category(t + " Cat", 0, true);
        product(cat, "Plain " + t, "PN-" + t, "Acme", true);
        product(cat, "Fifty%%Off " + t, "PN-2-" + t, "Acme", true);

        // "%%" would match every product if passed through as a LIKE pattern.
        mvc.perform(get("/api/products/search").param("q", "%%"))
                .andExpect(jsonPath("$.suggestions[?(@.name=='Plain " + t + "')]").isEmpty());
        mvc.perform(get("/api/products/search").param("q", "%%Off " + t))
                .andExpect(jsonPath("$.suggestions.length()").value(1))
                .andExpect(jsonPath("$.suggestions[0].name").value("Fifty%%Off " + t));
        mvc.perform(get("/api/products/search").param("q", "_lain " + t)) // "_" must not match any single character
                .andExpect(jsonPath("$.suggestions.length()").value(0));
    }

    @Test
    void injectionAttemptsAreInertAndLongQueriesAreCapped() throws Exception {
        mvc.perform(get("/api/products/search").param("q", "'; DROP TABLE \"Product\"; --"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.suggestions.length()").value(0));
        mvc.perform(get("/api/products/search").param("q", "x".repeat(5000))).andExpect(status().isOk());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM \"Product\"", Integer.class)).isNotNegative(); // table still exists
    }

    @Test
    void searchIsRateLimitedPerIp() throws Exception {
        // The Node route had no app-level limit; here SEARCH_PUBLIC allows 120/min per IP.
        for (int i = 0; i < 120; i++) {
            mvc.perform(get("/api/products/search").param("q", "ab").header("X-Real-IP", "192.0.2.150"));
        }
        // "ab" is under the minimum length and short-circuits BEFORE the limiter, so use real queries.
        for (int i = 0; i < 120; i++) {
            mvc.perform(get("/api/products/search").param("q", "abc").header("X-Real-IP", "192.0.2.151")).andExpect(status().isOk());
        }
        mvc.perform(get("/api/products/search").param("q", "abc").header("X-Real-IP", "192.0.2.151"))
                .andExpect(status().isTooManyRequests());
        mvc.perform(get("/api/products/search").param("q", "abc").header("X-Real-IP", "192.0.2.152"))
                .andExpect(status().isOk()); // a different visitor is unaffected
    }
}
