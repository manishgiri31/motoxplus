package com.motoxplus.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.motoxplus.api.catalog.PartCategoryValidator;
import com.motoxplus.api.catalog.PartCategoryValidator.Invalid;
import com.motoxplus.api.catalog.PartCategoryValidator.Valid;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.support.EncodedResource;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * GET /api/part-categories and the category-id validator against the same seed as CategoriesContractTest.
 * fixtures/part-categories.json was captured from the Node handler (src/app/api/part-categories/route.ts) on a
 * scratch PostgreSQL loaded with prisma-schema.sql + fixtures/categories.seed.sql.
 */
class PartCategoriesContractTest extends IntegrationTestBase {
    private static final JsonMapper JSON = JsonMapper.builder().build();

    @Autowired PartCategoryValidator validator;

    @BeforeEach
    void seed() throws Exception {
        clean();
        try (Connection c = dataSource.getConnection()) {
            ScriptUtils.executeSqlScript(c, new EncodedResource(new ClassPathResource("fixtures/categories.seed.sql"), StandardCharsets.UTF_8));
        }
    }

    @AfterEach
    void clean() {
        jdbc.execute("TRUNCATE TABLE \"Category\" CASCADE");
    }

    @Test
    void publicTreeMatchesTheNodeFixture() throws Exception {
        var res = mvc.perform(get("/api/part-categories")).andExpect(status().isOk()).andReturn().getResponse();
        JsonNode actual = JSON.readTree(res.getContentAsString(StandardCharsets.UTF_8));
        JsonNode expected = JSON.readTree(new ClassPathResource("fixtures/part-categories.json").getContentAsString(StandardCharsets.UTF_8));
        assertThat(actual.toString()).isEqualTo(expected.toString());
        assertThat(res.getHeader("Cache-Control")).contains("max-age=60");
    }

    @Test
    void validatorAcceptsLiveIdsAndNormalisesThem() {
        // Both subcategories of Lighting selected -> collapses to the group.
        assertThat(validator.validate(List.of("cat_fx_leds", "cat_fx_bulbs", "cat_fx_bulbs")))
                .isEqualTo(new Valid(List.of("cat_fx_lighting")));
        // A group with one of its own children -> just the group.
        assertThat(validator.validate(List.of("cat_fx_bulbs", "cat_fx_lighting")))
                .isEqualTo(new Valid(List.of("cat_fx_lighting")));
        assertThat(validator.validate(List.of("cat_fx_bulbs"))).isEqualTo(new Valid(List.of("cat_fx_bulbs")));
    }

    @Test
    void validatorRejectsInactiveUnknownAndNonCatalogueIds() {
        String gone = "One or more selected categories are no longer available. Refresh and try again.";
        assertThat(validator.validate(List.of("cat_fx_retired"))).isEqualTo(new Invalid(gone)); // inactive subcategory
        assertThat(validator.validate(List.of("cat_fx_signals"))).isEqualTo(new Invalid(gone)); // group with no active child
        assertThat(validator.validate(List.of("cat_fx_engine"))).isEqualTo(new Invalid(gone));  // shop-only category
        assertThat(validator.validate(List.of("nope"))).isEqualTo(new Invalid(gone));
        assertThat(validator.validate(List.of())).isEqualTo(new Invalid("Select at least one automotive parts category"));
    }
}
