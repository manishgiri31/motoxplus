package com.motoxplus.api.vendor.listings;

import java.math.BigDecimal;
import java.util.List;

/**
 * What a vendor may send when creating or editing a listing. Prices are rupees. There is deliberately no vendorId,
 * status, productId or commission field: ownership comes from the login, status changes only through publish /
 * unpublish, and anything else a client sends is ignored.
 */
public record ListingInput(
        String title,
        String description,
        String brand,
        String categoryId,
        String partNumber,
        String sku,
        String hsnCode,
        BigDecimal gstRate,
        Integer moq,
        Integer stock,
        String warranty,
        String countryOfOrigin,
        Integer weightGrams,
        BigDecimal mrp,
        BigDecimal retailPrice,
        BigDecimal dealerPrice,
        List<Fitment> fitment) {

    public record Fitment(String vehicleId, Integer yearFrom, Integer yearTo) {}
}
