package com.motoxplus.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.support.EncodedResource;
import org.springframework.http.MediaType;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Contract test for GET /api/categories: the Java response must equal, byte-for-structure, what the Node
 * route returned for the same rows.
 *
 * fixtures/categories.seed.sql is the fixed seed; fixtures/categories.json is the body captured by calling
 * the real Next.js handler (src/app/api/categories/route.ts GET) against a scratch PostgreSQL loaded with
 * that same seed and the same Prisma-generated schema (prisma-schema.sql). Re-capture whenever the Node
 * route or the seed changes.
 *
 * Both sides are re-serialised from parsed trees and compared as strings, so field NAMES, field ORDER,
 * array ORDER, nulls and value types all have to match; only insignificant whitespace is ignored.
 */
class CategoriesContractTest extends IntegrationTestBase {
    private static final JsonMapper JSON = JsonMapper.builder().build();

    @BeforeEach
    void seed() throws Exception {
        clean();
        try (Connection c = dataSource.getConnection()) {
            // Explicit UTF-8: the seed has non-ASCII text, and the one-argument overload would decode it with the
            // platform default charset (windows-1252 on Windows under Java 17), seeding mojibake.
            ScriptUtils.executeSqlScript(c, new EncodedResource(new ClassPathResource("fixtures/categories.seed.sql"), StandardCharsets.UTF_8));
        }
    }

    // The embedded database is shared with the other integration tests: leave nothing behind for them.
    @AfterEach
    void clean() {
        jdbc.execute("TRUNCATE TABLE \"Category\" CASCADE");
    }

    @Test
    void responseMatchesTheFixtureCapturedFromTheNodeRoute() throws Exception {
        var result = mvc.perform(get("/api/categories")).andExpect(status().isOk()).andReturn().getResponse();

        assertThat(MediaType.parseMediaType(result.getContentType()).isCompatibleWith(MediaType.APPLICATION_JSON)).isTrue();

        JsonNode actual = JSON.readTree(result.getContentAsString(StandardCharsets.UTF_8));
        JsonNode expected = JSON.readTree(new ClassPathResource("fixtures/categories.json").getContentAsString(StandardCharsets.UTF_8));

        assertThat(expected.isArray()).as("fixture is a JSON array").isTrue();
        assertThat(actual.isArray()).as("response is a JSON array").isTrue();
        assertThat(actual.size()).as("number of categories").isEqualTo(expected.size());
        for (int i = 0; i < expected.size(); i++) {
            // Per-element first, so a failure points at the category and field instead of one giant string.
            assertThat(actual.get(i).toString()).as("category #%d (%s)", i, expected.get(i).get("name").asString())
                    .isEqualTo(expected.get(i).toString());
        }
        assertThat(actual.toString()).isEqualTo(expected.toString());
    }
}
