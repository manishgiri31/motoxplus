package com.motoxplus.api.vendor.listings;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.Map;

/** JSON shapes for the vendor's listing screens. Prices go out in rupees; the API never exposes storage keys. */
public final class ListingView {
    private ListingView() {}

    static String ownerImageUrl(String listingId, String imageId) {
        return "/api/v1/vendors/me/listings/" + listingId + "/images/" + imageId;
    }

    public static Map<String, Object> detail(Listing l) {
        ListingRules.Draft d = l.draft();
        Map<String, Object> m = base(l, l.images().size());

        m.put("description", d.description());
        m.put("categoryId", d.categoryId());
        m.put("hsnCode", d.hsnCode());
        m.put("gstRate", plain(d.gstRate()));
        m.put("moq", d.moq());
        m.put("warranty", d.warranty());
        m.put("countryOfOrigin", d.countryOfOrigin());
        m.put("weightGrams", d.weightGrams());
        m.put("images", l.images().stream().map(i -> {
            Map<String, Object> img = new LinkedHashMap<>();
            img.put("id", i.id());
            img.put("url", ownerImageUrl(l.id(), i.id()));
            img.put("fileName", i.fileName());
            img.put("size", i.sizeBytes());
            img.put("mimeType", i.mimeType());
            img.put("primary", i.sortOrder() == 0);
            return img;
        }).toList());
        m.put("fitment", l.fitment().stream().map(f -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("vehicleId", f.vehicleId());
            row.put("vehicleName", f.vehicleName());
            row.put("manufacturer", f.manufacturer());
            row.put("yearFrom", f.yearFrom());
            row.put("yearTo", f.yearTo());
            return row;
        }).toList());
        m.put("firstPublishedAt", l.firstPublishedAt());
        m.put("publishedAt", l.publishedAt());
        m.put("unpublishedAt", l.unpublishedAt());
        m.put("createdAt", l.createdAt());
        return m;
    }

    public static Map<String, Object> summary(ListingRepository.Summary s) {
        Map<String, Object> m = base(s.listing(), s.imageCount());
        m.put("imageCount", s.imageCount());
        m.put("thumbnailUrl", s.primaryImageId() == null ? null : ownerImageUrl(s.listing().id(), s.primaryImageId()));
        return m;
    }

    /** Fields both the table row and the editor need, including the publish checklist. */
    private static Map<String, Object> base(Listing l, int imageCount) {
        ListingRules.Draft d = l.draft();
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", l.id());
        m.put("status", l.status());
        m.put("title", d.title());
        m.put("brand", d.brand());
        m.put("categoryName", l.categoryName());
        m.put("partNumber", d.partNumber());
        m.put("sku", d.sku());
        m.put("mrp", rupees(d.mrpPaise()));
        m.put("retailPrice", rupees(d.retailPaise()));
        m.put("dealerPrice", rupees(d.dealerPaise()));
        m.put("stock", d.stock());

        Map<String, String> problems = ListingRules.publishProblems(d, imageCount);
        Map<String, Object> readiness = new LinkedHashMap<>();
        readiness.put("ready", problems.isEmpty());
        readiness.put("problems", problems);
        m.put("readiness", readiness);

        Map<String, Object> storefront = new LinkedHashMap<>();
        storefront.put("visible", l.live() && l.productActive());
        storefront.put("url", l.productSlug() == null ? null : "/products/" + l.productSlug());
        m.put("storefront", storefront);
        m.put("updatedAt", l.updatedAt());
        return m;
    }

    static BigDecimal rupees(Long paise) {
        if (paise == null) return null;
        return paise % 100 == 0 ? BigDecimal.valueOf(paise / 100) : BigDecimal.valueOf(paise, 2);
    }

    private static BigDecimal plain(BigDecimal v) {
        return v == null ? null : new BigDecimal(v.stripTrailingZeros().toPlainString());
    }
}
