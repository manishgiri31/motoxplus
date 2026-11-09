package com.motoxplus.api.vendor.listings;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class ListingRulesTest {

    static ListingInput valid() {
        return new ListingInput("Front brake pad set for Splendor", "Semi-metallic pads.", "Kumar Friction", "cat-pads", "45105-KWP-901",
                "KF-BP-001", "8714", new BigDecimal("18"), 1, 25, "6 months", "India", 250,
                new BigDecimal("499"), new BigDecimal("449"), new BigDecimal("320"), List.of());
    }

    static ListingInput withPrices(String mrp, String retail, String dealer) {
        ListingInput v = valid();
        return new ListingInput(v.title(), v.description(), v.brand(), v.categoryId(), v.partNumber(), v.sku(), v.hsnCode(), v.gstRate(),
                v.moq(), v.stock(), v.warranty(), v.countryOfOrigin(), v.weightGrams(),
                mrp == null ? null : new BigDecimal(mrp), retail == null ? null : new BigDecimal(retail),
                dealer == null ? null : new BigDecimal(dealer), v.fitment());
    }

    @Test
    void aCompleteListingIsCleanAndPricesAreStoredInPaise() {
        ListingRules.Cleaned c = ListingRules.clean(valid());
        assertThat(c.errors()).isEmpty();
        assertThat(c.draft().mrpPaise()).isEqualTo(49_900L);
        assertThat(c.draft().retailPaise()).isEqualTo(44_900L);
        assertThat(c.draft().dealerPaise()).isEqualTo(32_000L);
        assertThat(ListingRules.publishProblems(c.draft(), 1)).isEmpty();
    }

    @Test
    void priceOrderingIsMrpThenRetailThenDealer() {
        assertThat(ListingRules.clean(withPrices("400", "450", "300")).errors())
                .containsOnlyKeys("retailPrice")
                .containsEntry("retailPrice", "Retail price can't be higher than the MRP");
        assertThat(ListingRules.clean(withPrices("500", "400", "450")).errors())
                .containsOnlyKeys("dealerPrice")
                .containsEntry("dealerPrice", "Dealer price can't be higher than the retail price");
        // With retail not entered yet, the dealer price is still checked against the MRP.
        assertThat(ListingRules.clean(withPrices("300", null, "350")).errors())
                .containsEntry("dealerPrice", "Dealer price can't be higher than the MRP");
        // Equal prices are allowed (>=).
        assertThat(ListingRules.clean(withPrices("400", "400", "400")).errors()).isEmpty();
    }

    @Test
    void everyPriceMustBeAboveZeroAndAWholeRupeeAmount() {
        assertThat(ListingRules.clean(withPrices("0", "449", "320")).errors()).containsEntry("mrp", "MRP must be more than ₹0");
        assertThat(ListingRules.clean(withPrices("499", "-1", "320")).errors()).containsEntry("retailPrice", "Retail price must be more than ₹0");
        assertThat(ListingRules.clean(withPrices("499", "449", "319.50")).errors())
                .containsEntry("dealerPrice", "Dealer price must be a whole rupee amount");
        assertThat(ListingRules.clean(withPrices("499.00", "449.0", "320")).errors()).isEmpty();
        assertThat(ListingRules.clean(withPrices("1000001", "449", "320")).errors()).containsKey("mrp");
    }

    @Test
    void aDraftMayBeIncompleteButPublishingNeedsEverythingRequired() {
        ListingInput onlyTitle = new ListingInput("Clutch plate", null, null, null, null, null, null, null, null, null, null, null, null,
                null, null, null, null);
        ListingRules.Cleaned c = ListingRules.clean(onlyTitle);
        assertThat(c.errors()).isEmpty();
        assertThat(c.draft().countryOfOrigin()).isEqualTo("India");
        assertThat(c.draft().gstRate()).isEqualByComparingTo("18");
        assertThat(c.draft().moq()).isEqualTo(1);

        Map<String, String> problems = ListingRules.publishProblems(c.draft(), 0);
        assertThat(problems.keySet()).containsExactly("categoryId", "brand", "partNumber", "sku", "images", "mrp", "retailPrice",
                "dealerPrice", "stock", "hsnCode");
        assertThat(problems).containsEntry("images", "Add at least one photo");
    }

    @Test
    void stockMustBeAtLeastOneAndCoverTheMinimumOrder() {
        ListingRules.Draft d = ListingRules.clean(valid()).draft();
        ListingRules.Draft noStock = new ListingRules.Draft(d.title(), d.description(), d.brand(), d.categoryId(), d.partNumber(), d.sku(),
                d.hsnCode(), d.gstRate(), d.moq(), 0, d.warranty(), d.countryOfOrigin(), d.weightGrams(), d.mrpPaise(), d.retailPaise(),
                d.dealerPaise(), d.fitment());
        assertThat(ListingRules.publishProblems(noStock, 1)).containsOnlyKeys("stock");

        ListingRules.Draft belowMoq = new ListingRules.Draft(d.title(), d.description(), d.brand(), d.categoryId(), d.partNumber(), d.sku(),
                d.hsnCode(), d.gstRate(), 10, 4, d.warranty(), d.countryOfOrigin(), d.weightGrams(), d.mrpPaise(), d.retailPaise(),
                d.dealerPaise(), d.fitment());
        assertThat(ListingRules.publishProblems(belowMoq, 1)).containsEntry("stock", "Stock must cover your minimum order quantity (10)");
    }

    @Test
    void formatRulesForTaxCodesAndIdentifiers() {
        ListingInput v = valid();
        ListingInput bad = new ListingInput("ab", v.description(), v.brand(), v.categoryId(), "!", "has space", "871",
                new BigDecimal("12"), 0, -1, v.warranty(), v.countryOfOrigin(), 0, v.mrp(), v.retailPrice(), v.dealerPrice(), List.of());
        Map<String, String> e = ListingRules.clean(bad).errors();
        assertThat(e).containsKeys("title", "partNumber", "sku", "hsnCode", "gstRate", "moq", "stock", "weightGrams");
        assertThat(e.get("gstRate")).isEqualTo("Choose a GST rate: 0%, 5%, 18% or 40%");

        ListingInput ok = new ListingInput(v.title(), v.description(), v.brand(), v.categoryId(), "45105 KWP 901", "KF/BP_01.A", "8714 10 90",
                new BigDecimal("5"), v.moq(), v.stock(), v.warranty(), v.countryOfOrigin(), v.weightGrams(), v.mrp(), v.retailPrice(),
                v.dealerPrice(), List.of());
        ListingRules.Cleaned c = ListingRules.clean(ok);
        assertThat(c.errors()).isEmpty();
        assertThat(c.draft().hsnCode()).isEqualTo("87141090");
    }

    @Test
    void fitmentIsDeduplicatedAndYearRangesChecked() {
        ListingInput v = valid();
        List<ListingInput.Fitment> dupes = List.of(new ListingInput.Fitment("veh-1", 2015, 2020), new ListingInput.Fitment("veh-1", 2016, null),
                new ListingInput.Fitment("veh-2", null, null));
        ListingRules.Cleaned c = ListingRules.clean(new ListingInput(v.title(), v.description(), v.brand(), v.categoryId(), v.partNumber(),
                v.sku(), v.hsnCode(), v.gstRate(), v.moq(), v.stock(), v.warranty(), v.countryOfOrigin(), v.weightGrams(), v.mrp(),
                v.retailPrice(), v.dealerPrice(), dupes));
        assertThat(c.errors()).isEmpty();
        assertThat(c.draft().fitment()).extracting(ListingRules.Fitment::vehicleId).containsExactly("veh-1", "veh-2");

        ListingRules.Cleaned backwards = ListingRules.clean(new ListingInput(v.title(), null, null, null, null, null, null, null, null, null,
                null, null, null, null, null, null, List.of(new ListingInput.Fitment("veh-1", 2020, 2015))));
        assertThat(backwards.errors()).containsKey("fitment");

        List<ListingInput.Fitment> many = new ArrayList<>();
        for (int i = 0; i < ListingRules.MAX_FITMENT + 1; i++) many.add(new ListingInput.Fitment("veh-" + i, null, null));
        assertThat(ListingRules.clean(new ListingInput(v.title(), null, null, null, null, null, null, null, null, null, null, null, null,
                null, null, null, many)).errors()).containsKey("fitment");
    }

    @Test
    void errorsAreOrderedLikeTheEditor() {
        Map<String, String> mixed = new java.util.LinkedHashMap<>();
        mixed.put("hsnCode", "x");
        mixed.put("sku", "x");
        mixed.put("title", "x");
        mixed.put("images", "x");
        assertThat(ListingRules.ordered(mixed).keySet()).containsExactly("title", "sku", "images", "hsnCode");
    }
}
