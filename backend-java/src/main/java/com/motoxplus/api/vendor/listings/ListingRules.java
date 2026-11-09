package com.motoxplus.api.vendor.listings;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Listing validation in one place, with no database access, so every rule is unit-tested
 * (src/lib/vendor/listings.ts mirrors these rules and messages for instant feedback in the browser).
 *
 * <p>Two levels: {@link #clean} checks the FORMAT of whatever was sent and runs on every save, so a draft may be
 * incomplete but never wrong. {@link #publishProblems} checks COMPLETENESS and runs when a listing goes live and on
 * every edit of a live listing, so a live listing is never incomplete.
 *
 * <p>Error maps are ordered like the editor's sections, so the first error is the first field on screen.
 */
public final class ListingRules {
    private ListingRules() {}

    public static final int MAX_IMAGES = 8;
    public static final long MAX_IMAGE_BYTES = 5L * 1024 * 1024;
    public static final int MAX_FITMENT = 50;
    /** Highest price accepted for any of the three prices: Rs 10 lakh. */
    public static final BigDecimal MAX_PRICE_RUPEES = new BigDecimal("1000000");
    /**
     * GST slabs after the September 2025 rationalisation (auto parts are 18%). Kept here rather than in the database
     * because it is a legal fact that changes rarely, not a business setting.
     */
    public static final List<BigDecimal> GST_RATES = List.of(BigDecimal.ZERO, new BigDecimal("5"), new BigDecimal("18"), new BigDecimal("40"));
    public static final BigDecimal DEFAULT_GST_RATE = new BigDecimal("18");

    private static final Pattern PART_NUMBER = Pattern.compile("^[A-Za-z0-9][A-Za-z0-9 ./_-]*$");
    private static final Pattern SKU = Pattern.compile("^[A-Za-z0-9][A-Za-z0-9./_-]*$");
    private static final Pattern HSN = Pattern.compile("^([0-9]{4}|[0-9]{6}|[0-9]{8})$");

    /** A listing's editable content after cleaning. Prices are paise; null means "not filled in yet". */
    public record Draft(String title, String description, String brand, String categoryId, String partNumber, String sku,
                        String hsnCode, BigDecimal gstRate, int moq, Integer stock, String warranty, String countryOfOrigin,
                        Integer weightGrams, Long mrpPaise, Long retailPaise, Long dealerPaise, List<Fitment> fitment) {}

    public record Fitment(String vehicleId, Integer yearFrom, Integer yearTo) {}

    public record Cleaned(Draft draft, Map<String, String> errors) {
        public boolean ok() { return errors.isEmpty(); }
    }

    // ------------------------------------------------------------------ format (every save)

    public static Cleaned clean(ListingInput in) {
        Map<String, String> e = new LinkedHashMap<>();

        String title = line(in.title());
        if (title.isEmpty()) e.put("title", "Add a product title");
        else if (title.length() < 3) e.put("title", "Title must be at least 3 characters");
        else if (title.length() > 150) e.put("title", "Title must be at most 150 characters");

        String categoryId = blankToNull(line(in.categoryId()));

        String brand = blankToNull(line(in.brand()));
        if (brand != null && brand.length() > 80) e.put("brand", "Brand must be at most 80 characters");

        String partNumber = blankToNull(line(in.partNumber()));
        if (partNumber != null) {
            if (partNumber.length() < 2 || partNumber.length() > 60) e.put("partNumber", "Part number must be 2 to 60 characters");
            else if (!PART_NUMBER.matcher(partNumber).matches()) {
                e.put("partNumber", "Use letters, numbers, spaces and . / - _ only");
            }
        }

        String sku = blankToNull(line(in.sku()));
        if (sku != null) {
            if (sku.length() > 60) e.put("sku", "SKU must be at most 60 characters");
            else if (!SKU.matcher(sku).matches()) e.put("sku", "Use letters, numbers and . / - _ only (no spaces)");
        }

        String description = in.description() == null ? null : blankToNull(in.description().strip());
        if (description != null && description.length() > 5000) e.put("description", "Description must be at most 5,000 characters");

        Long mrp = price(in.mrp(), "mrp", "MRP", e);
        Long retail = price(in.retailPrice(), "retailPrice", "Retail price", e);
        Long dealer = price(in.dealerPrice(), "dealerPrice", "Dealer price", e);
        priceOrder(mrp, retail, dealer, e);

        Integer stock = in.stock();
        if (stock != null && (stock < 0 || stock > 1_000_000)) e.put("stock", "Stock must be between 0 and 10,00,000");

        int moq = in.moq() == null ? 1 : in.moq();
        if (moq < 1 || moq > 10_000) e.put("moq", "Minimum order quantity must be between 1 and 10,000");

        List<Fitment> fitment = fitment(in.fitment(), e);

        String hsn = blankToNull(line(in.hsnCode()).replace(" ", ""));
        if (hsn != null && !HSN.matcher(hsn).matches()) e.put("hsnCode", "HSN code is 4, 6 or 8 digits");

        BigDecimal gst = in.gstRate() == null ? DEFAULT_GST_RATE : in.gstRate();
        if (GST_RATES.stream().noneMatch(r -> r.compareTo(gst) == 0)) e.put("gstRate", "Choose a GST rate: 0%, 5%, 18% or 40%");

        Integer weight = in.weightGrams();
        if (weight != null && (weight < 1 || weight > 100_000)) e.put("weightGrams", "Packed weight must be between 1 g and 100 kg");

        String warranty = blankToNull(line(in.warranty()));
        if (warranty != null && warranty.length() > 80) e.put("warranty", "Warranty must be at most 80 characters");

        String origin = line(in.countryOfOrigin());
        if (origin.isEmpty()) origin = "India";
        else if (origin.length() < 2 || origin.length() > 60) e.put("countryOfOrigin", "Country of origin must be 2 to 60 characters");

        Draft d = new Draft(title, description, brand, categoryId, partNumber, sku, hsn, gst, moq, stock,
                warranty, origin, weight, mrp, retail, dealer, fitment);
        return new Cleaned(d, e);
    }

    /**
     * Rupees to paise. Each price must be a whole rupee amount above zero: the storefront's dealer price column
     * (public."Product".price) holds whole rupees, and the three prices are kept in the same unit so they compare
     * cleanly. Storage is paise, so allowing paise later is a validation change only.
     */
    static Long price(BigDecimal rupees, String field, String label, Map<String, String> e) {
        if (rupees == null) return null;
        if (rupees.signum() <= 0) {
            e.put(field, label + " must be more than ₹0");
            return null;
        }
        if (rupees.stripTrailingZeros().scale() > 0) {
            e.put(field, label + " must be a whole rupee amount");
            return null;
        }
        if (rupees.compareTo(MAX_PRICE_RUPEES) > 0) {
            e.put(field, label + " can't be more than ₹10,00,000");
            return null;
        }
        return rupees.movePointRight(2).longValueExact();
    }

    /** MRP >= retail >= dealer. The message goes on the lower price, which is the one that is out of place. */
    static void priceOrder(Long mrp, Long retail, Long dealer, Map<String, String> e) {
        if (mrp != null && retail != null && retail > mrp) {
            e.putIfAbsent("retailPrice", "Retail price can't be higher than the MRP");
        }
        if (retail != null && dealer != null && dealer > retail) {
            e.putIfAbsent("dealerPrice", "Dealer price can't be higher than the retail price");
        } else if (retail == null && mrp != null && dealer != null && dealer > mrp) {
            e.putIfAbsent("dealerPrice", "Dealer price can't be higher than the MRP");
        }
    }

    private static List<Fitment> fitment(List<ListingInput.Fitment> in, Map<String, String> e) {
        if (in == null || in.isEmpty()) return List.of();
        if (in.size() > MAX_FITMENT) {
            e.put("fitment", "List at most " + MAX_FITMENT + " vehicles");
            return List.of();
        }
        Set<String> seen = new LinkedHashSet<>();
        List<Fitment> out = new ArrayList<>();
        for (ListingInput.Fitment f : in) {
            String id = f == null ? "" : line(f.vehicleId());
            if (id.isEmpty() || id.length() > 64) {
                e.put("fitment", "One of the vehicles is not valid");
                return List.of();
            }
            Integer from = f.yearFrom();
            Integer to = f.yearTo();
            if ((from != null && (from < 1950 || from > 2100)) || (to != null && (to < 1950 || to > 2100))) {
                e.put("fitment", "Years must be between 1950 and 2100");
                return List.of();
            }
            if (from != null && to != null && from > to) {
                e.put("fitment", "A vehicle's 'from' year must not be after its 'to' year");
                return List.of();
            }
            if (seen.add(id)) out.add(new Fitment(id, from, to));
        }
        return List.copyOf(out);
    }

    // ------------------------------------------------------------------ completeness (publish, and edits while live)

    /** Everything that stops this draft from going live, keyed by field; empty when it is ready. */
    public static Map<String, String> publishProblems(Draft d, int imageCount) {
        Map<String, String> p = new LinkedHashMap<>();
        if (d.title() == null || d.title().length() < 3) p.put("title", "Add a product title");
        if (d.categoryId() == null) p.put("categoryId", "Choose a category");
        if (d.brand() == null) p.put("brand", "Add the brand");
        if (d.partNumber() == null) p.put("partNumber", "Add the part number");
        if (d.sku() == null) p.put("sku", "Add your SKU");
        if (imageCount < 1) p.put("images", "Add at least one photo");
        if (d.mrpPaise() == null) p.put("mrp", "Enter the MRP");
        if (d.retailPaise() == null) p.put("retailPrice", "Enter the retail price");
        if (d.dealerPaise() == null) p.put("dealerPrice", "Enter the dealer price");
        if (d.stock() == null || d.stock() < 1) p.put("stock", "Add at least 1 unit of stock");
        else if (d.stock() < d.moq()) p.put("stock", "Stock must cover your minimum order quantity (" + d.moq() + ")");
        if (d.hsnCode() == null) p.put("hsnCode", "Add the HSN code");
        return p;
    }

    // ------------------------------------------------------------------ helpers

    /** The editor's field order, top to bottom. */
    static final List<String> FIELD_ORDER = List.of("title", "categoryId", "brand", "partNumber", "sku", "description", "images",
            "mrp", "retailPrice", "dealerPrice", "stock", "moq", "fitment", "hsnCode", "gstRate", "weightGrams", "warranty",
            "countryOfOrigin");

    /** Re-orders an error map (format errors + database checks) into the editor's order. */
    public static Map<String, String> ordered(Map<String, String> errors) {
        Map<String, String> out = new LinkedHashMap<>();
        for (String f : FIELD_ORDER) if (errors.containsKey(f)) out.put(f, errors.get(f));
        errors.forEach(out::putIfAbsent);
        return out;
    }

    /** Trims and collapses internal whitespace (single-line fields). */
    static String line(String s) {
        return s == null ? "" : s.strip().replaceAll("\\s+", " ");
    }

    private static String blankToNull(String s) {
        return s == null || s.isEmpty() ? null : s;
    }
}
