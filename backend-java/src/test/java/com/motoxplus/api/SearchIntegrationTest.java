package com.motoxplus.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;
import org.hamcrest.Matchers;
import org.junit.jupiter.api.Test;

/** GET /api/search against the real Prisma-created tables. */
class SearchIntegrationTest extends IntegrationTestBase {

    static String id(String prefix) {
        return prefix + UUID.randomUUID().toString().replace("-", "").substring(0, 20);
    }

    /** A token unique to one test (letters only, so full-text treats it as one word). */
    static String token() {
        var rnd = java.util.concurrent.ThreadLocalRandom.current();
        StringBuilder b = new StringBuilder("zq");
        for (int i = 0; i < 8; i++) b.append((char) ('a' + rnd.nextInt(26)));
        return b.toString();
    }

    String category(String name, String parentId) {
        String id = id("c");
        jdbc.update("""
                INSERT INTO "Category" (id, name, slug, "isActive", "parentId", "updatedAt")
                VALUES (?, ?, ?, true, ?, now())""", id, name, name.toLowerCase().replace(' ', '-'), parentId);
        return id;
    }

    void product(String categoryId, String name, String partNumber, String brand, boolean active, String... fits) {
        String id = id("p");
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
            ps.setArray(9, con.createArrayOf("text", fits));
            ps.setArray(10, con.createArrayOf("text", new String[0]));
            return ps;
        });
    }

    void vehicle(String manufacturer, String name, String category, String... aliases) {
        String mId = id("m");
        jdbc.update("""
                INSERT INTO "VehicleManufacturer" (id, name, slug, "updatedAt") VALUES (?, ?, ?, now())""",
                mId, manufacturer, mId);
        jdbc.update(con -> {
            var ps = con.prepareStatement("""
                    INSERT INTO "Vehicle" (id, name, slug, category, "manufacturerId", "searchAliases", "updatedAt")
                    VALUES (?, ?, ?, CAST(? AS "VehicleCategory"), ?, ?, now())""");
            ps.setString(1, id("v"));
            ps.setString(2, name);
            ps.setString(3, "veh-" + name.toLowerCase().replace(' ', '-'));
            ps.setString(4, category);
            ps.setString(5, mId);
            ps.setArray(6, con.createArrayOf("text", aliases));
            return ps;
        });
    }

    @Test
    void ranksExactThenPrefixThenFullTextThenSubstring() throws Exception {
        String t = token();
        String cat = category("Brakes " + token(), null); // category text is searchable too: keep t out of it
        product(cat, "Rear pad " + t + " kit", "PN1-" + UUID.randomUUID(), "Acme", true);  // full-text (word in the middle)
        product(cat, "Disc" + t + "x", "PN2-" + UUID.randomUUID(), "Acme", true);         // substring only
        product(cat, t + " shoe", "PN3-" + UUID.randomUUID(), "Acme", true);               // prefix
        product(cat, t, "PN4-" + UUID.randomUUID(), "Acme", true);                         // exact

        mvc.perform(get("/api/search").param("q", t).param("type", "products"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.groups[0].type").value("products"))
                .andExpect(jsonPath("$.groups[0].title").value("Products"))
                .andExpect(jsonPath("$.groups[0].items[0].title").value(t))
                .andExpect(jsonPath("$.groups[0].items[1].title").value(t + " shoe"))
                .andExpect(jsonPath("$.groups[0].items[2].title").value("Rear pad " + t + " kit"))
                .andExpect(jsonPath("$.groups[0].items[3].title").value("Disc" + t + "x"))
                .andExpect(jsonPath("$.groups[0].items[0].url").value(Matchers.startsWith("/products/slug-")))
                .andExpect(jsonPath("$.groups[0].items[0].icon").value("product"))
                .andExpect(jsonPath("$.groups[0].items[0].snippet").value(Matchers.containsString("Part No. PN4-")));
    }

    @Test
    void multiWordQueriesMatchAcrossNameAndFitmentAndGroupByType() throws Exception {
        String t = token();
        String cat = category(t + " Clutch", null);
        product(cat, "Clutch plate", "PN-" + UUID.randomUUID(), "Acme", true, "Hero Splendor " + t);
        product(cat, "Clutch cable", "PN-" + UUID.randomUUID(), "Acme", true, "Bajaj Pulsar");
        vehicle("Hero", "Splendor " + t, "MOTORCYCLE");

        mvc.perform(get("/api/search").param("q", "splendor " + t + " clutch"))
                .andExpect(jsonPath("$.groups[?(@.type=='products')].items[*].title").value(Matchers.contains("Clutch plate")));

        mvc.perform(get("/api/search").param("q", "splendor " + t))
                .andExpect(jsonPath("$.groups[*].type").value(Matchers.contains("products", "vehicles")))
                .andExpect(jsonPath("$.groups[1].items[0].title").value("Hero Splendor " + t))
                .andExpect(jsonPath("$.groups[1].items[0].url").value("/vehicles/motorcycle/veh-splendor-" + t));

        mvc.perform(get("/api/search").param("q", t + " clutch"))
                .andExpect(jsonPath("$.groups[?(@.type=='categories')].items[0].url").value(
                        Matchers.hasItem("/products?category=" + t + "-clutch")));
    }

    @Test
    void pluralQueriesFindSingularNamesAndWordsMatchInAnyOrder() throws Exception {
        String t = token();
        String cat = category("Wheels " + token(), null);
        product(cat, "Front brake shoe " + t, "PN-" + UUID.randomUUID(), "Acme", true);

        mvc.perform(get("/api/search").param("q", "brakes " + t).param("type", "products"))
                .andExpect(jsonPath("$.groups[0].items[*].title").value(Matchers.contains("Front brake shoe " + t)));
        mvc.perform(get("/api/search").param("q", t + " shoes front").param("type", "products"))
                .andExpect(jsonPath("$.groups[0].items[*].title").value(Matchers.contains("Front brake shoe " + t)));
        mvc.perform(get("/api/search").param("q", "(shoe) " + t).param("type", "products")) // regex chars are literal
                .andExpect(status().isOk()).andExpect(jsonPath("$.groups.length()").value(0));
    }

    @Test
    void staticPagesMatchByIntent() throws Exception {
        mvc.perform(get("/api/search").param("q", "refund"))
                .andExpect(jsonPath("$.groups[?(@.type=='pages')].items[0].url").value(Matchers.hasItem("/cancellation-policy")));
    }

    @Test
    void categoryFilterIncludesSubcategoriesAndLimitPagesWithHasMore() throws Exception {
        String t = token();
        String parent = category(t + " Engine", null);
        String child = category(t + " Pistons", parent);
        String other = category(t + " Body", null);
        for (int i = 0; i < 3; i++) product(child, "Piston " + t + " " + i, "PN-" + UUID.randomUUID(), "Acme", true);
        product(other, "Mirror " + t, "PN-" + UUID.randomUUID(), "Acme", true);

        mvc.perform(get("/api/search").param("q", t).param("type", "products")
                        .param("category", t + "-engine").param("limit", "2").param("sort", "name"))
                .andExpect(jsonPath("$.groups[0].items.length()").value(2))
                .andExpect(jsonPath("$.groups[0].items[0].title").value("Piston " + t + " 0"))
                .andExpect(jsonPath("$.hasMore").value(true));
        mvc.perform(get("/api/search").param("q", t).param("type", "products")
                        .param("category", t + "-engine").param("limit", "2").param("offset", "2").param("sort", "name"))
                .andExpect(jsonPath("$.groups[0].items.length()").value(1))
                .andExpect(jsonPath("$.hasMore").value(false));
    }

    @Test
    void limitDefaultsToEightAndIsCappedAtTwenty() throws Exception {
        String t = token();
        String cat = category(t + " Bulk", null);
        for (int i = 0; i < 25; i++) product(cat, "Bolt " + t + " " + i, "PN-" + UUID.randomUUID(), "Acme", true);

        mvc.perform(get("/api/search").param("q", t).param("type", "products"))
                .andExpect(jsonPath("$.groups[0].items.length()").value(8));
        mvc.perform(get("/api/search").param("q", t).param("type", "products").param("limit", "500"))
                .andExpect(jsonPath("$.groups[0].items.length()").value(20));
        mvc.perform(get("/api/search").param("q", t).param("type", "products").param("limit", "abc"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.groups[0].items.length()").value(8));
    }

    @Test
    void emptyAndTooShortQueriesReturnNoGroups() throws Exception {
        for (String q : new String[] {null, "", "   ", "a", " a ", "​​b"}) {
            var r = q == null ? get("/api/search") : get("/api/search").param("q", q);
            mvc.perform(r).andExpect(status().isOk())
                    .andExpect(jsonPath("$.groups.length()").value(0))
                    .andExpect(jsonPath("$.hasMore").value(false));
        }
    }

    @Test
    void noResultsReturnsEmptyGroupsAndEchoesTheCleanedQuery() throws Exception {
        mvc.perform(get("/api/search").param("q", "  qqxx" + UUID.randomUUID().toString().substring(0, 6) + "   nothing  "))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.groups.length()").value(0))
                .andExpect(jsonPath("$.query").value(Matchers.matchesPattern("qqxx\\S+ nothing")));
    }

    @Test
    void specialCharactersAreLiteralAndHarmless() throws Exception {
        String t = token();
        String cat = category("Misc " + token(), null);
        product(cat, "Plain " + t, "PN-" + UUID.randomUUID(), "Acme", true);
        product(cat, "Fifty%Discount " + t, "PN-" + UUID.randomUUID(), "Acme", true);
        product(cat, "Oil seal 25/40 " + t, "PN-" + UUID.randomUUID(), "Acme", true);

        mvc.perform(get("/api/search").param("q", "%Discount " + t))
                .andExpect(jsonPath("$.groups[0].items[*].title").value(Matchers.contains("Fifty%Discount " + t)));
        mvc.perform(get("/api/search").param("q", "%%")) // would match everything if passed through as a pattern
                .andExpect(jsonPath("$.groups[*].items[?(@.title=='Plain " + t + "')]").isEmpty());
        mvc.perform(get("/api/search").param("q", "_lain " + t)) // "_" is not a single-character wildcard
                .andExpect(jsonPath("$.groups.length()").value(0));
        mvc.perform(get("/api/search").param("q", "25/40 " + t))
                .andExpect(jsonPath("$.groups[0].items[0].title").value("Oil seal 25/40 " + t));

        // Operators, quotes, backslashes, tsquery syntax and SQL fragments must never error.
        for (String q : new String[] {"'; DROP TABLE \"Product\"; --", "\\\\", "a & b | !c", "\"unterminated", "<script>",
                "():*", "-" + t, "or or", "x".repeat(5000)}) {
            mvc.perform(get("/api/search").param("q", q)).andExpect(status().isOk());
        }
        assertThat(jdbc.queryForObject("SELECT count(*) FROM \"Product\"", Integer.class)).isPositive();
    }

    @Test
    void inactiveProductsNeverAppear() throws Exception {
        String t = token();
        String cat = category(t + " Hidden", null);
        product(cat, "Gone " + t, "PN-" + UUID.randomUUID(), "Acme", false);
        mvc.perform(get("/api/search").param("q", "gone " + t).param("type", "products"))
                .andExpect(jsonPath("$.groups.length()").value(0));
    }

    @Test
    void rateLimitedToSixtyPerMinutePerIp() throws Exception {
        for (int i = 0; i < 60; i++) {
            mvc.perform(get("/api/search").param("q", "abc").header("X-Real-IP", "192.0.2.160")).andExpect(status().isOk());
        }
        mvc.perform(get("/api/search").param("q", "abc").header("X-Real-IP", "192.0.2.160"))
                .andExpect(status().isTooManyRequests());
        mvc.perform(get("/api/search").param("q", "abc").header("X-Real-IP", "192.0.2.161"))
                .andExpect(status().isOk());
        // Too-short queries return before the limiter, so idle keystrokes never spend budget.
        mvc.perform(get("/api/search").param("q", "a").header("X-Real-IP", "192.0.2.160")).andExpect(status().isOk());
    }

    @Test
    void typicalQueryIsFast() throws Exception {
        String t = token();
        String cat = category(t + " Perf", null);
        for (int i = 0; i < 200; i++) product(cat, "Part " + i + " " + t, "PN-" + UUID.randomUUID(), "Acme", true, "Hero Splendor");
        mvc.perform(get("/api/search").param("q", "warmup")); // first call pays JIT / connection-pool warm-up

        long best = Long.MAX_VALUE;
        for (int i = 0; i < 5; i++) {
            long start = System.nanoTime();
            mvc.perform(get("/api/search").param("q", "splendor").header("X-Real-IP", "192.0.2.170")).andExpect(status().isOk());
            best = Math.min(best, (System.nanoTime() - start) / 1_000_000);
        }
        assertThat(best).as("best-of-5 latency in ms").isLessThan(150);
    }
}
