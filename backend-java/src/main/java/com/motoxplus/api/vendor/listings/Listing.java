package com.motoxplus.api.vendor.listings;

import java.time.OffsetDateTime;
import java.util.List;

/** One listing as stored, with its photos and fitment. Always loaded for a known owner (see ListingRepository). */
public record Listing(
        String id,
        String vendorId,
        String productId,      // null until first published
        String status,         // DRAFT | LIVE | UNPUBLISHED
        ListingRules.Draft draft,
        String categoryName,
        String productSlug,    // storefront URL slug once published
        boolean productActive, // visible on the storefront right now (LIVE and vendor approved)
        OffsetDateTime firstPublishedAt,
        OffsetDateTime publishedAt,
        OffsetDateTime unpublishedAt,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt,
        List<Image> images,
        List<FitmentRow> fitment) {

    public static final String DRAFT = "DRAFT";
    public static final String LIVE = "LIVE";
    public static final String UNPUBLISHED = "UNPUBLISHED";

    public record Image(String id, String objectKey, String storedUrl, String mimeType, int sizeBytes, String fileName, int sortOrder) {}

    public record FitmentRow(String vehicleId, String vehicleName, String manufacturer, Integer yearFrom, Integer yearTo) {}

    public boolean live() { return LIVE.equals(status); }
}
