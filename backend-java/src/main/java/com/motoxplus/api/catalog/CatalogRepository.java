package com.motoxplus.api.catalog;

import com.motoxplus.api.common.Time;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * Read-only SQL for the public catalog. Plain SQL rather than JPA entities: these are flat
 * projections (no object graph to maintain) and it keeps the queries identical to what Prisma runs.
 */
@Repository
public class CatalogRepository {
    private final NamedParameterJdbcTemplate jdbc;

    public CatalogRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public record Suggestion(String id, String slug, String name, String partNumber, String brand,
                             String categoryName, String imageUrl) {}

    /** Active categories in display order, each with the total number of products in it. */
    public List<Map<String, Object>> activeCategories() {
        return jdbc.query("""
                SELECT c.id, c.name, c.slug, c.description, c.image, c."sortOrder", c."isActive",
                       c."createdAt", c."updatedAt",
                       (SELECT count(*) FROM "Product" p WHERE p."categoryId" = c.id) AS "productCount"
                FROM "Category" c
                WHERE c."isActive" = true
                ORDER BY c."sortOrder" ASC, c.name ASC
                """, (rs, i) -> categoryRow(rs));
    }

    private static Map<String, Object> categoryRow(ResultSet rs) throws SQLException {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", rs.getString("id"));
        m.put("name", rs.getString("name"));
        m.put("slug", rs.getString("slug"));
        m.put("description", rs.getString("description"));
        m.put("image", rs.getString("image"));
        m.put("sortOrder", rs.getInt("sortOrder"));
        m.put("isActive", rs.getBoolean("isActive"));
        m.put("createdAt", Time.iso(rs.getObject("createdAt", LocalDateTime.class)));
        m.put("updatedAt", Time.iso(rs.getObject("updatedAt", LocalDateTime.class)));
        m.put("_count", Map.of("products", rs.getLong("productCount")));
        return m;
    }

    /** Active products whose name, part number, brand or SKU contains the (already escaped) pattern. */
    public List<Suggestion> searchByFields(String likePattern, int limit) {
        return jdbc.query("""
                SELECT p.id, p.slug, p.name, p."partNumber", p.brand, c.name AS "categoryName",
                       (SELECT pi."imageUrl" FROM "ProductImage" pi
                         WHERE pi."productId" = p.id AND pi."isPrimary" = true LIMIT 1) AS "imageUrl"
                FROM "Product" p
                JOIN "Category" c ON c.id = p."categoryId"
                WHERE p."isActive" = true
                  AND (p.name ILIKE :pat ESCAPE '\\' OR p."partNumber" ILIKE :pat ESCAPE '\\'
                       OR p.brand ILIKE :pat ESCAPE '\\' OR p.sku ILIKE :pat ESCAPE '\\')
                ORDER BY p.name ASC
                LIMIT :limit
                """, new MapSqlParameterSource("pat", likePattern).addValue("limit", limit), CatalogRepository::suggestion);
    }

    /** Active products whose vehicle-compatibility list has an entry containing the pattern. */
    public List<Suggestion> searchByCompatibility(String likePattern, int limit) {
        return jdbc.query("""
                SELECT p.id, p.slug, p.name, p."partNumber", p.brand, c.name AS "categoryName",
                       NULL AS "imageUrl"
                FROM "Product" p
                JOIN "Category" c ON c.id = p."categoryId"
                WHERE p."isActive" = true
                  AND EXISTS (SELECT 1 FROM unnest(p.compatibility) AS compat WHERE compat ILIKE :pat ESCAPE '\\')
                ORDER BY p.name ASC
                LIMIT :limit
                """, new MapSqlParameterSource("pat", likePattern).addValue("limit", limit), CatalogRepository::suggestion);
    }

    private static Suggestion suggestion(ResultSet rs, int i) throws SQLException {
        return new Suggestion(rs.getString("id"), rs.getString("slug"), rs.getString("name"),
                rs.getString("partNumber"), rs.getString("brand"), rs.getString("categoryName"),
                rs.getString("imageUrl"));
    }
}
