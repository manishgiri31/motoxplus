package com.motoxplus.api.vendor.listings;

import com.motoxplus.api.common.Cuid;
import com.motoxplus.api.marketplace.common.PageResponse;
import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * Every query on the listing tables. Each read that returns a vendor's data takes the vendor id as a parameter and
 * filters on it in SQL: a listing that belongs to someone else is indistinguishable from one that does not exist.
 */
@Repository
@ConditionalOnProperty(name = "marketplace.enabled", havingValue = "true")
public class ListingRepository {
    private final JdbcTemplate jdbc;

    public ListingRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    // ------------------------------------------------------------------ reads

    private static final String SELECT = """
            SELECT l.*, c.name AS category_name, p.slug AS product_slug, COALESCE(p."isActive", false) AS product_active,
                   (SELECT count(*) FROM marketplace.vendor_listing_image i WHERE i.listing_id = l.id) AS image_count,
                   (SELECT i.id FROM marketplace.vendor_listing_image i WHERE i.listing_id = l.id
                    ORDER BY i.sort_order, i.created_at LIMIT 1) AS primary_image_id
            FROM marketplace.vendor_listing l
            LEFT JOIN public."Category" c ON c.id = l.category_id
            LEFT JOIN public."Product" p ON p.id = l.product_id
            """;

    public Optional<Listing> find(String vendorId, String listingId) {
        List<Listing> rows = jdbc.query(SELECT + " WHERE l.id = ? AND l.vendor_id = ?", (rs, i) -> listing(rs), listingId, vendorId);
        if (rows.isEmpty()) return Optional.empty();
        Listing base = rows.get(0);
        List<Listing.FitmentRow> fitment = fitmentRows(base.id());
        return Optional.of(new Listing(base.id(), base.vendorId(), base.productId(), base.status(),
                withFitment(base.draft(), fitment), base.categoryName(), base.productSlug(), base.productActive(),
                base.firstPublishedAt(), base.publishedAt(), base.unpublishedAt(), base.createdAt(), base.updatedAt(),
                images(base.id()), fitment));
    }

    /** Row lock for the rest of the current transaction (publish, image changes), then the full listing. */
    public Optional<Listing> lock(String vendorId, String listingId) {
        List<String> ids = jdbc.queryForList(
                "SELECT id FROM marketplace.vendor_listing WHERE id = ? AND vendor_id = ? FOR UPDATE", String.class, listingId, vendorId);
        return ids.isEmpty() ? Optional.empty() : find(vendorId, listingId);
    }

    /** One row of the vendor's listing table. */
    public record Summary(Listing listing, int imageCount, String primaryImageId) {}

    public PageResponse<Summary> page(String vendorId, String status, String q, int page, int size) {
        StringBuilder where = new StringBuilder(" WHERE l.vendor_id = ?");
        List<Object> args = new ArrayList<>();
        args.add(vendorId);
        if (status != null) {
            where.append(" AND l.status = ?");
            args.add(status);
        }
        if (q != null) {
            String like = "%" + q.toLowerCase(Locale.ROOT).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
            where.append(" AND (lower(l.title) LIKE ? ESCAPE '\\' OR lower(l.part_number) LIKE ? ESCAPE '\\' OR lower(l.sku) LIKE ? ESCAPE '\\')");
            args.add(like);
            args.add(like);
            args.add(like);
        }
        Long total = jdbc.queryForObject("SELECT count(*) FROM marketplace.vendor_listing l" + where, Long.class, args.toArray());
        List<Object> pageArgs = new ArrayList<>(args);
        pageArgs.add(size);
        pageArgs.add((long) page * size);
        List<Summary> items = jdbc.query(SELECT + where + " ORDER BY l.updated_at DESC, l.id LIMIT ? OFFSET ?",
                (rs, i) -> new Summary(listing(rs), rs.getInt("image_count"), rs.getString("primary_image_id")), pageArgs.toArray());
        return PageResponse.of(items, page, size, total == null ? 0 : total);
    }

    public Map<String, Long> counts(String vendorId) {
        Map<String, Long> out = new LinkedHashMap<>();
        out.put(Listing.DRAFT, 0L);
        out.put(Listing.LIVE, 0L);
        out.put(Listing.UNPUBLISHED, 0L);
        jdbc.query("SELECT status, count(*) FROM marketplace.vendor_listing WHERE vendor_id = ? GROUP BY status",
                rs -> { out.put(rs.getString(1), rs.getLong(2)); }, vendorId);
        out.put("ALL", out.values().stream().mapToLong(Long::longValue).sum());
        return out;
    }

    public List<Listing.Image> images(String listingId) {
        return jdbc.query("""
                SELECT id, object_key, stored_url, mime_type, size_bytes, file_name, sort_order
                FROM marketplace.vendor_listing_image WHERE listing_id = ? ORDER BY sort_order, created_at
                """, (rs, i) -> new Listing.Image(rs.getString(1), rs.getString(2), rs.getString(3), rs.getString(4), rs.getInt(5),
                rs.getString(6), rs.getInt(7)), listingId);
    }

    private List<Listing.FitmentRow> fitmentRows(String listingId) {
        return jdbc.query("""
                SELECT f.vehicle_id, v.name, m.name, f.year_from, f.year_to
                FROM marketplace.vendor_listing_fitment f
                JOIN public."Vehicle" v ON v.id = f.vehicle_id
                JOIN public."VehicleManufacturer" m ON m.id = v."manufacturerId"
                WHERE f.listing_id = ? ORDER BY m.name, v.name
                """, (rs, i) -> new Listing.FitmentRow(rs.getString(1), rs.getString(2), rs.getString(3),
                (Integer) rs.getObject(4, Integer.class), (Integer) rs.getObject(5, Integer.class)), listingId);
    }

    /** An image of a listing owned by this vendor (any status). */
    public Optional<Listing.Image> ownedImage(String vendorId, String listingId, String imageId) {
        return jdbc.query("""
                SELECT i.id, i.object_key, i.stored_url, i.mime_type, i.size_bytes, i.file_name, i.sort_order
                FROM marketplace.vendor_listing_image i JOIN marketplace.vendor_listing l ON l.id = i.listing_id
                WHERE i.id = ? AND i.listing_id = ? AND l.vendor_id = ?
                """, (rs, i) -> new Listing.Image(rs.getString(1), rs.getString(2), rs.getString(3), rs.getString(4), rs.getInt(5),
                rs.getString(6), rs.getInt(7)), imageId, listingId, vendorId).stream().findFirst();
    }

    /** An image anyone may see: its listing is live and its vendor is approved. */
    public Optional<Listing.Image> publicImage(String imageId) {
        return jdbc.query("""
                SELECT i.id, i.object_key, i.stored_url, i.mime_type, i.size_bytes, i.file_name, i.sort_order
                FROM marketplace.vendor_listing_image i
                JOIN marketplace.vendor_listing l ON l.id = i.listing_id
                JOIN public."Vendor" v ON v.id = l.vendor_id
                WHERE i.id = ? AND l.status = 'LIVE' AND v.status = 'APPROVED'
                """, (rs, i) -> new Listing.Image(rs.getString(1), rs.getString(2), rs.getString(3), rs.getString(4), rs.getInt(5),
                rs.getString(6), rs.getInt(7)), imageId).stream().findFirst();
    }

    // ------------------------------------------------------------------ lookups used by validation

    public boolean skuTaken(String vendorId, String sku, String exceptListingId) {
        return !jdbc.queryForList("SELECT 1 FROM marketplace.vendor_listing WHERE vendor_id = ? AND sku = ? AND id <> ?",
                Integer.class, vendorId, sku, exceptListingId == null ? "" : exceptListingId).isEmpty();
    }

    /**
     * Subcategories this vendor may list under: an active subcategory of an active group, where the vendor chose the
     * group (covers all its subcategories) or that subcategory. A vendor with no chosen categories (accounts from
     * before the parts catalogue) may use any, matching getVendorListableCategoryIds in the Node app.
     */
    private static final String LISTABLE = """
            SELECT k.id, k.name, g.id AS group_id, g.name AS group_name
            FROM public."Category" k
            JOIN public."Category" g ON g.id = k."parentId"
            WHERE k."isActive" = true AND g."isActive" = true AND g."parentId" IS NULL
              AND (NOT EXISTS (SELECT 1 FROM public."VendorPartCategory" x WHERE x."vendorId" = ?)
                   OR EXISTS (SELECT 1 FROM public."VendorPartCategory" x WHERE x."vendorId" = ? AND x."categoryId" IN (k.id, g.id)))
            """;

    public boolean categoryListable(String vendorId, String categoryId) {
        return !jdbc.queryForList("SELECT id FROM (" + LISTABLE + ") t WHERE t.id = ?", String.class, vendorId, vendorId, categoryId).isEmpty();
    }

    public record CategoryOption(String id, String name) {}
    public record CategoryGroup(String id, String name, List<CategoryOption> children) {}

    public List<CategoryGroup> listableCategories(String vendorId) {
        Map<String, CategoryGroup> groups = new LinkedHashMap<>();
        jdbc.query(LISTABLE.replace("SELECT k.id, k.name, g.id AS group_id, g.name AS group_name",
                        "SELECT k.id, k.name, g.id AS group_id, g.name AS group_name, g.\"sortOrder\" AS gs, k.\"sortOrder\" AS ks")
                        + " ORDER BY gs, group_name, ks, k.name",
                rs -> {
                    String groupId = rs.getString("group_id");
                    String groupName = rs.getString("group_name");
                    groups.computeIfAbsent(groupId, id -> new CategoryGroup(id, groupName, new ArrayList<>()))
                            .children().add(new CategoryOption(rs.getString("id"), rs.getString("name")));
                }, vendorId, vendorId);
        return List.copyOf(groups.values());
    }

    public Set<String> activeVehicles(Collection<String> ids) {
        if (ids.isEmpty()) return Set.of();
        return new HashSet<>(jdbc.queryForList("SELECT id FROM public.\"Vehicle\" WHERE \"isActive\" = true AND id = ANY (?)",
                String.class, (Object) ids.toArray(String[]::new)));
    }

    public record VehicleOption(String id, String name, String manufacturer, String category, Integer yearFrom, Integer yearTo) {}

    /** Typeahead for the fitment picker: active vehicles by model or "Manufacturer Model". */
    public List<VehicleOption> searchVehicles(String q, int limit) {
        String like = "%" + q.toLowerCase(Locale.ROOT).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
        return jdbc.query("""
                SELECT v.id, v.name, m.name, v.category::text, v."yearFrom", v."yearTo"
                FROM public."Vehicle" v JOIN public."VehicleManufacturer" m ON m.id = v."manufacturerId"
                WHERE v."isActive" = true AND m."isActive" = true
                  AND (lower(v.name) LIKE ? ESCAPE '\\' OR lower(m.name || ' ' || v.name) LIKE ? ESCAPE '\\')
                ORDER BY (lower(v.name) LIKE ? ESCAPE '\\') DESC, m.name, v."sortOrder", v.name
                LIMIT ?
                """, (rs, i) -> new VehicleOption(rs.getString(1), rs.getString(2), rs.getString(3), rs.getString(4),
                (Integer) rs.getObject(5, Integer.class), (Integer) rs.getObject(6, Integer.class)),
                like, like, like.substring(1), limit);
    }

    // ------------------------------------------------------------------ writes (callers hold the transaction)

    public String insert(String vendorId, String userId, ListingRules.Draft d) {
        String id = Cuid.next();
        jdbc.update("""
                INSERT INTO marketplace.vendor_listing (id, vendor_id, status, title, description, brand, category_id, part_number, sku,
                    hsn_code, gst_rate, moq, warranty, country_of_origin, weight_grams, mrp_paise, retail_price_paise,
                    dealer_price_paise, stock_quantity, created_by, updated_by)
                VALUES (?, ?, 'DRAFT', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, ps -> {
            int i = 1;
            ps.setString(i++, id);
            ps.setString(i++, vendorId);
            i = bindDraft(ps, i, d);
            ps.setString(i++, userId);
            ps.setString(i, userId);
        });
        replaceFitment(id, d.fitment());
        return id;
    }

    public void update(String listingId, String userId, ListingRules.Draft d) {
        jdbc.update("""
                UPDATE marketplace.vendor_listing SET title = ?, description = ?, brand = ?, category_id = ?, part_number = ?, sku = ?,
                    hsn_code = ?, gst_rate = ?, moq = ?, warranty = ?, country_of_origin = ?, weight_grams = ?, mrp_paise = ?,
                    retail_price_paise = ?, dealer_price_paise = ?, stock_quantity = ?, updated_at = now(), updated_by = ?
                WHERE id = ?
                """, ps -> {
            int i = bindDraft(ps, 1, d);
            ps.setString(i++, userId);
            ps.setString(i, listingId);
        });
        replaceFitment(listingId, d.fitment());
    }

    private static int bindDraft(java.sql.PreparedStatement ps, int i, ListingRules.Draft d) throws SQLException {
        ps.setString(i++, d.title());
        ps.setString(i++, d.description());
        ps.setString(i++, d.brand());
        ps.setString(i++, d.categoryId());
        ps.setString(i++, d.partNumber());
        ps.setString(i++, d.sku());
        ps.setString(i++, d.hsnCode());
        ps.setBigDecimal(i++, d.gstRate());
        ps.setInt(i++, d.moq());
        ps.setString(i++, d.warranty());
        ps.setString(i++, d.countryOfOrigin());
        setInt(ps, i++, d.weightGrams());
        setLong(ps, i++, d.mrpPaise());
        setLong(ps, i++, d.retailPaise());
        setLong(ps, i++, d.dealerPaise());
        setInt(ps, i++, d.stock());
        return i;
    }

    private void replaceFitment(String listingId, List<ListingRules.Fitment> fitment) {
        jdbc.update("DELETE FROM marketplace.vendor_listing_fitment WHERE listing_id = ?", listingId);
        for (ListingRules.Fitment f : fitment) {
            jdbc.update("INSERT INTO marketplace.vendor_listing_fitment (listing_id, vehicle_id, year_from, year_to) VALUES (?, ?, ?, ?)",
                    listingId, f.vehicleId(), f.yearFrom(), f.yearTo());
        }
    }

    public void markLive(String listingId, String productId, String userId) {
        jdbc.update("""
                UPDATE marketplace.vendor_listing SET status = 'LIVE', product_id = ?, published_at = now(),
                    first_published_at = COALESCE(first_published_at, now()), unpublished_at = NULL, updated_at = now(), updated_by = ?
                WHERE id = ?
                """, productId, userId, listingId);
    }

    public void markUnpublished(String listingId, String userId) {
        jdbc.update("""
                UPDATE marketplace.vendor_listing SET status = 'UNPUBLISHED', unpublished_at = now(), updated_at = now(), updated_by = ?
                WHERE id = ?
                """, userId, listingId);
    }

    public void touch(String listingId, String userId) {
        jdbc.update("UPDATE marketplace.vendor_listing SET updated_at = now(), updated_by = ? WHERE id = ?", userId, listingId);
    }

    public void insertImage(String imageId, String listingId, String key, String storedUrl, String mime, int size, String sha256,
                            String fileName, String userId) {
        jdbc.update("""
                INSERT INTO marketplace.vendor_listing_image (id, listing_id, object_key, stored_url, mime_type, size_bytes, sha256, file_name,
                    sort_order, created_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?,
                        (SELECT COALESCE(max(sort_order) + 1, 0) FROM marketplace.vendor_listing_image WHERE listing_id = ?), ?)
                """, imageId, listingId, key, storedUrl, mime, size, sha256, fileName, listingId, userId);
    }

    public void deleteImage(String listingId, String imageId) {
        jdbc.update("DELETE FROM marketplace.vendor_listing_image WHERE id = ? AND listing_id = ?", imageId, listingId);
        renumber(listingId, null);
    }

    /** Makes {@code firstImageId} the primary photo (sort 0) and closes gaps, keeping the others' relative order. */
    public void renumber(String listingId, String firstImageId) {
        jdbc.update("""
                UPDATE marketplace.vendor_listing_image i SET sort_order = r.n
                FROM (SELECT id, row_number() OVER (ORDER BY (id = ?) DESC, sort_order, created_at) - 1 AS n
                      FROM marketplace.vendor_listing_image WHERE listing_id = ?) r
                WHERE i.id = r.id AND i.sort_order <> r.n
                """, firstImageId == null ? "" : firstImageId, listingId);
    }

    // ------------------------------------------------------------------ mapping

    private static ListingRules.Draft withFitment(ListingRules.Draft d, List<Listing.FitmentRow> rows) {
        return new ListingRules.Draft(d.title(), d.description(), d.brand(), d.categoryId(), d.partNumber(), d.sku(), d.hsnCode(),
                d.gstRate(), d.moq(), d.stock(), d.warranty(), d.countryOfOrigin(), d.weightGrams(), d.mrpPaise(), d.retailPaise(),
                d.dealerPaise(), rows.stream().map(f -> new ListingRules.Fitment(f.vehicleId(), f.yearFrom(), f.yearTo())).toList());
    }

    private static Listing listing(ResultSet rs) throws SQLException {
        BigDecimal gst = rs.getBigDecimal("gst_rate");
        var draft = new ListingRules.Draft(rs.getString("title"), rs.getString("description"), rs.getString("brand"),
                rs.getString("category_id"), rs.getString("part_number"), rs.getString("sku"), rs.getString("hsn_code"), gst,
                rs.getInt("moq"), (Integer) rs.getObject("stock_quantity", Integer.class), rs.getString("warranty"),
                rs.getString("country_of_origin"), (Integer) rs.getObject("weight_grams", Integer.class),
                (Long) rs.getObject("mrp_paise", Long.class), (Long) rs.getObject("retail_price_paise", Long.class),
                (Long) rs.getObject("dealer_price_paise", Long.class), List.of());
        return new Listing(rs.getString("id"), rs.getString("vendor_id"), rs.getString("product_id"), rs.getString("status"), draft,
                rs.getString("category_name"), rs.getString("product_slug"), rs.getBoolean("product_active"),
                odt(rs, "first_published_at"), odt(rs, "published_at"), odt(rs, "unpublished_at"), odt(rs, "created_at"),
                odt(rs, "updated_at"), List.of(), List.of());
    }

    private static OffsetDateTime odt(ResultSet rs, String col) throws SQLException {
        return rs.getObject(col, OffsetDateTime.class);
    }

    private static void setInt(java.sql.PreparedStatement ps, int i, Integer v) throws SQLException {
        if (v == null) ps.setNull(i, Types.INTEGER); else ps.setInt(i, v);
    }

    private static void setLong(java.sql.PreparedStatement ps, int i, Long v) throws SQLException {
        if (v == null) ps.setNull(i, Types.BIGINT); else ps.setLong(i, v);
    }
}
