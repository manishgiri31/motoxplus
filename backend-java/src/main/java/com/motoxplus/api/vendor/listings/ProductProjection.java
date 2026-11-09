package com.motoxplus.api.vendor.listings;

import com.motoxplus.api.common.Cuid;
import com.motoxplus.api.web.ApiException;
import java.sql.Types;
import java.util.List;
import java.util.Locale;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Keeps one public."Product" row in step with each published listing. This is how a listing reaches the existing
 * storefront, product page and search (GET /api/search reads active "Product" rows), with no change to any of them
 * and no new index: publishing writes the row, unpublishing hides it.
 *
 * <p>The listing stays the source of truth: every projection rewrites the vendor-owned fields from it. Mapping:
 * dealer price -> Product.price (whole rupees), MRP -> Product.mrp, photos -> ProductImage rows served by the Java
 * API from the private bucket, fitment -> ProductCompatibility rows marked UNVERIFIED / IMPORTED (never confirmed).
 * The retail price is not projected: "Product" has no column for it (decision V5 keeps it on the listing).
 *
 * <p>Every method runs inside the caller's transaction (MANDATORY), with the listing row locked.
 */
@Component
@ConditionalOnProperty(name = "marketplace.enabled", havingValue = "true")
public class ProductProjection {
    /** Public URL of a live listing's photo (same origin; Nginx and the Next dev rewrite send /api/v1 to Java). */
    public static final String IMAGE_PATH = "/api/v1/listing-images/";
    static final String FITMENT_NOTE = "Reported by the seller. Not verified by MotoXPlus.";
    private static final String NOW = "(now() AT TIME ZONE 'UTC')"; // Prisma's zone-less UTC timestamps

    private final JdbcTemplate jdbc;

    public ProductProjection(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * Creates the product on first publish, otherwise rewrites it; then its photos and fitment. Visible only while
     * the vendor is APPROVED. Returns the product id.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public String publish(Listing l, String vendorCode) {
        ListingRules.Draft d = l.draft();
        String productId = l.productId() != null ? l.productId() : Cuid.next();
        String sku = vendorCode + "-" + d.sku();
        String partNumber = partNumberFor(productId, d.partNumber(), vendorCode, d.sku());
        int dealerRupees = Math.toIntExact(d.dealerPaise() / 100);
        double mrpRupees = d.mrpPaise() / 100.0;
        Double packageKg = d.weightGrams() == null ? null : d.weightGrams() / 1000.0;
        String visible = "(SELECT status = 'APPROVED' FROM public.\"Vendor\" WHERE id = ?)";

        try {
            if (l.productId() == null) {
                jdbc.update("""
                        INSERT INTO public."Product" (id, name, sku, "partNumber", description, "categoryId", moq, price, mrp, "gstRate",
                            images, compatibility, "isActive", stock, "stockStatus", "createdAt", "updatedAt", brand, "countryOfOrigin",
                            "hsnCode", warranty, "packageWeight", "vendorId", source, slug)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ARRAY[]::text[], ARRAY[]::text[], %s, ?, 'IN_STOCK', %s, %s, ?, ?, ?,
                                COALESCE(?, 'No Warranty'), ?, ?, 'VENDOR', ?)
                        """.formatted(visible, NOW, NOW), ps -> {
                    int i = 1;
                    ps.setString(i++, productId);
                    ps.setString(i++, d.title());
                    ps.setString(i++, sku);
                    ps.setString(i++, partNumber);
                    ps.setString(i++, d.description());
                    ps.setString(i++, d.categoryId());
                    ps.setInt(i++, d.moq());
                    ps.setInt(i++, dealerRupees);
                    ps.setDouble(i++, mrpRupees);
                    ps.setDouble(i++, d.gstRate().doubleValue());
                    ps.setString(i++, l.vendorId());
                    ps.setInt(i++, d.stock());
                    ps.setString(i++, d.brand());
                    ps.setString(i++, d.countryOfOrigin());
                    ps.setString(i++, d.hsnCode());
                    ps.setString(i++, d.warranty());
                    if (packageKg == null) ps.setNull(i++, Types.DOUBLE); else ps.setDouble(i++, packageKg);
                    ps.setString(i++, l.vendorId());
                    ps.setString(i, uniqueSlug(d.title()));
                });
            } else {
                jdbc.update("""
                        UPDATE public."Product" SET name = ?, sku = ?, "partNumber" = ?, description = ?, "categoryId" = ?, moq = ?,
                            price = ?, mrp = ?, "gstRate" = ?, "isActive" = %s, stock = ?, "stockStatus" = 'IN_STOCK', brand = ?,
                            "countryOfOrigin" = ?, "hsnCode" = ?, warranty = COALESCE(?, 'No Warranty'), "packageWeight" = ?,
                            "vendorId" = ?, source = 'VENDOR', "updatedAt" = %s
                        WHERE id = ?
                        """.formatted(visible, NOW), ps -> {
                    int i = 1;
                    ps.setString(i++, d.title());
                    ps.setString(i++, sku);
                    ps.setString(i++, partNumber);
                    ps.setString(i++, d.description());
                    ps.setString(i++, d.categoryId());
                    ps.setInt(i++, d.moq());
                    ps.setInt(i++, dealerRupees);
                    ps.setDouble(i++, mrpRupees);
                    ps.setDouble(i++, d.gstRate().doubleValue());
                    ps.setString(i++, l.vendorId());
                    ps.setInt(i++, d.stock());
                    ps.setString(i++, d.brand());
                    ps.setString(i++, d.countryOfOrigin());
                    ps.setString(i++, d.hsnCode());
                    ps.setString(i++, d.warranty());
                    if (packageKg == null) ps.setNull(i++, Types.DOUBLE); else ps.setDouble(i++, packageKg);
                    ps.setString(i++, l.vendorId());
                    ps.setString(i, productId);
                });
            }
        } catch (DuplicateKeyException e) {
            // Product.sku is "<vendorCode>-<sku>", unique by construction; only a hand-made catalogue row could clash.
            throw new ApiException(HttpStatus.CONFLICT, "This SKU clashes with an existing catalogue product. Change your SKU or contact MotoXPlus.",
                    "CATALOGUE_CONFLICT", null);
        }
        photos(l.id(), productId);
        fitment(productId, d.fitment());
        return productId;
    }

    /** Rewrites the product's photos from the listing (after a photo is added, removed or reordered while live). */
    @Transactional(propagation = Propagation.MANDATORY)
    public void photos(String listingId, String productId) {
        jdbc.update("DELETE FROM public.\"ProductImage\" WHERE \"productId\" = ?", productId);
        jdbc.update("""
                INSERT INTO public."ProductImage" (id, "productId", "imageUrl", key, "isPrimary", "sortOrder", "createdAt", "fileName",
                    "fileSize", "mimeType")
                SELECT i.id, ?, ? || i.id, '', row_number() OVER (ORDER BY i.sort_order, i.created_at) = 1, i.sort_order, %s,
                       i.file_name, i.size_bytes, i.mime_type
                FROM marketplace.vendor_listing_image i WHERE i.listing_id = ?
                """.formatted(NOW), productId, IMAGE_PATH, listingId);
        jdbc.update("""
                UPDATE public."Product" SET images = ARRAY(SELECT ? || i.id FROM marketplace.vendor_listing_image i
                                                          WHERE i.listing_id = ? ORDER BY i.sort_order, i.created_at),
                       "updatedAt" = %s
                WHERE id = ?
                """.formatted(NOW), IMAGE_PATH, listingId, productId);
    }

    /** Seller-reported fitment, replacing only the rows this projection wrote (admin-verified rows are kept). */
    private void fitment(String productId, List<ListingRules.Fitment> fitment) {
        jdbc.update("""
                DELETE FROM public."ProductCompatibility"
                WHERE "productId" = ? AND source = 'IMPORTED' AND confidence = 'UNVERIFIED' AND "fitmentNote" = ?
                """, productId, FITMENT_NOTE);
        for (ListingRules.Fitment f : fitment) {
            jdbc.update("""
                    INSERT INTO public."ProductCompatibility" (id, "productId", "vehicleId", "yearFrom", "yearTo", confidence, source,
                        "fitmentNote", "isActive", "createdAt", "updatedAt")
                    VALUES (?, ?, ?, ?, ?, 'UNVERIFIED', 'IMPORTED', ?, true, %s, %s)
                    """.formatted(NOW, NOW), Cuid.next(), productId, f.vehicleId(), f.yearFrom(), f.yearTo(), FITMENT_NOTE);
        }
    }

    /** Takes the product off the storefront (unpublish). The row, its URL and its photos stay for a later re-publish. */
    @Transactional(propagation = Propagation.MANDATORY)
    public void hide(String productId) {
        jdbc.update("UPDATE public.\"Product\" SET \"isActive\" = false, \"updatedAt\" = " + NOW + " WHERE id = ?", productId);
    }

    /**
     * After a vendor's status changes (suspend, block, reactivate): their live listings are visible exactly while
     * the vendor is APPROVED. Returns the number of products changed.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public int syncVendor(String vendorId) {
        return jdbc.update("""
                UPDATE public."Product" p SET "isActive" = (l.status = 'LIVE' AND v.status = 'APPROVED'), "updatedAt" = %s
                FROM marketplace.vendor_listing l JOIN public."Vendor" v ON v.id = l.vendor_id
                WHERE p.id = l.product_id AND l.vendor_id = ?
                  AND p."isActive" IS DISTINCT FROM (l.status = 'LIVE' AND v.status = 'APPROVED')
                """.formatted(NOW), vendorId);
    }

    /**
     * Product.partNumber is unique across the whole catalogue, but several vendors (or MotoXPlus itself) can sell the
     * same OEM part number. Use the vendor's part number as-is when it is free, so buyers see and search the real
     * number; otherwise suffix it with the vendor code (and, for a vendor's own repeat, their SKU).
     */
    String partNumberFor(String productId, String partNumber, String vendorCode, String sku) {
        for (String candidate : List.of(partNumber, partNumber + "-" + vendorCode, partNumber + "-" + vendorCode + "-" + sku)) {
            if (jdbc.queryForList("SELECT 1 FROM public.\"Product\" WHERE \"partNumber\" = ? AND id <> ?", Integer.class,
                    candidate, productId).isEmpty()) {
                return candidate;
            }
        }
        throw new ApiException(HttpStatus.CONFLICT, "This part number clashes with an existing catalogue product. Contact MotoXPlus.",
                "CATALOGUE_CONFLICT", null);
    }

    /** Same algorithm as uniqueProductSlug() in src/lib/slug.ts: slugify, then -2, -3 ... until free. */
    String uniqueSlug(String title) {
        String base = slugify(title);
        String candidate = base;
        for (int attempt = 2; attempt < 200; attempt++) {
            if (jdbc.queryForList("SELECT 1 FROM public.\"Product\" WHERE slug = ?", Integer.class, candidate).isEmpty()) return candidate;
            candidate = base + "-" + attempt;
        }
        return base + "-" + Cuid.next().substring(1, 9);
    }

    static String slugify(String s) {
        String slug = s.toLowerCase(Locale.ROOT).strip().replaceAll("[^a-z0-9]+", "-").replaceAll("^-+|-+$", "");
        return slug.isEmpty() ? "product" : slug;
    }
}
