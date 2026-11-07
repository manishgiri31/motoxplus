package com.motoxplus.api.search;

import java.util.List;
import java.util.Locale;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * Ranked catalogue search over plain SQL, with no search index or extension needed.
 *
 * <p>A product matches when <em>every</em> word of the query appears somewhere in its text (name, brand,
 * part number, SKU, category, vehicle fitment), so "splendor clutch" finds clutch parts that fit a Splendor.
 * Matches are ranked: 0 = exact name / part number / SKU, 1 = name or part number starts with the query,
 * 2 = every word starts a word in the name, 3 = every word starts a word anywhere, 4 = substring only
 * (partial part numbers like "4501"). Ties go to the shorter, more specific name.
 *
 * <p>Why not to_tsvector: computing it per row costs ~300ms over the 8k-product catalogue, and indexing it
 * needs a Flyway migration. Substring matching over the same text is ~40ms and handles part numbers better.
 *
 * <p>All user text reaches SQL as bind parameters and LIKE patterns are escaped, so a typed "%" or "_" is literal.
 */
@Repository
public class SearchRepository {
    private final NamedParameterJdbcTemplate jdbc;

    public SearchRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public enum Sort { RELEVANCE, NAME, NEWEST }

    public record ProductHit(String slug, String name, String partNumber, String brand, String categoryName, String imageUrl) {}
    public record CategoryHit(String slug, String name, String parentName) {}
    public record VehicleHit(String slug, String name, String manufacturer, String category) {}

    /** Bind values shared by every query: exact, prefix and substring forms of the (lower-cased) query. */
    private static MapSqlParameterSource params(String q) {
        String lower = q.toLowerCase(Locale.ROOT);
        String escaped = SearchQuery.escapeLike(lower);
        return new MapSqlParameterSource()
                .addValue("exact", lower)
                .addValue("prefix", escaped + "%")
                .addValue("contains", "%" + escaped + "%");
    }

    /**
     * Products, optionally limited to one category (and its subcategories). Fetches {@code limit} rows
     * starting at {@code offset}; callers ask for one extra row to learn whether more exist.
     */
    public List<ProductHit> products(String q, String categorySlug, Sort sort, int limit, int offset) {
        List<String> words = SearchQuery.words(q);
        if (words.isEmpty()) return List.of();
        MapSqlParameterSource p = params(q)
                .addValue("category", categorySlug)
                .addValue("limit", limit)
                .addValue("offset", offset);

        // m.lname / m.hay are lower-cased and start with a space, so "% word%" means "a word starts with it".
        StringBuilder allInHay = new StringBuilder();
        StringBuilder startsInName = new StringBuilder();
        StringBuilder startsInHay = new StringBuilder();
        for (int i = 0; i < words.size(); i++) {
            String w = SearchQuery.escapeLike(words.get(i));
            p.addValue("w" + i, "%" + w + "%");
            p.addValue("sw" + i, "% " + w + "%");
            String and = i == 0 ? "" : " AND ";
            allInHay.append(and).append("m.hay LIKE :w").append(i).append(" ESCAPE '\\'");
            startsInName.append(and).append("m.lname LIKE :sw").append(i).append(" ESCAPE '\\'");
            startsInHay.append(and).append("m.hay LIKE :sw").append(i).append(" ESCAPE '\\'");
        }

        String order = switch (sort) {
            case NAME -> "name ASC, id";
            case NEWEST -> "\"createdAt\" DESC, id";
            case RELEVANCE -> "tier ASC, length(name) ASC, name ASC, id";
        };

        // The OFFSET 0 subquery is an optimisation fence: it builds each row's search text once, instead of the
        // planner re-deriving it for every LIKE (measured 200ms -> ~55ms on the 8k-product catalogue).
        String sql = """
                WITH r AS MATERIALIZED (
                    SELECT m.id, m.slug, m.name, m."partNumber", m.brand, m."createdAt", m."categoryName",
                           CASE WHEN m.lname = ' ' || :exact OR m.lpn = :exact OR m.lsku = :exact THEN 0
                                WHEN m.lname LIKE ' ' || :prefix ESCAPE '\\' OR m.lpn LIKE :prefix ESCAPE '\\' THEN 1
                                WHEN %s THEN 2
                                WHEN %s THEN 3
                                ELSE 4 END AS tier
                    FROM (SELECT p.id, p.slug, p.name, p."partNumber", p.brand, p."createdAt", c.name AS "categoryName",
                                 lower(p."partNumber") AS lpn, lower(p.sku) AS lsku, ' ' || lower(p.name) AS lname,
                                 ' ' || lower(p.name || ' ' || p.brand || ' ' || p."partNumber" || ' ' || p.sku || ' '
                                     || c.name || ' ' || array_to_string(p.compatibility, ' ')) AS hay
                          FROM "Product" p
                          JOIN "Category" c ON c.id = p."categoryId"
                          WHERE p."isActive" = true
                            AND (CAST(:category AS text) IS NULL
                                 OR c.slug = :category
                                 OR c."parentId" IN (SELECT k.id FROM "Category" k WHERE k.slug = :category))
                          OFFSET 0) m
                    WHERE %s
                    ORDER BY %s
                    LIMIT :limit OFFSET :offset
                )
                SELECT r.slug, r.name, r."partNumber", r.brand, r."categoryName", img."imageUrl"
                FROM r
                LEFT JOIN (SELECT DISTINCT ON (pi."productId") pi."productId", pi."imageUrl"
                           FROM "ProductImage" pi
                           WHERE pi."isPrimary" = true AND pi."productId" IN (SELECT id FROM r)
                           ORDER BY pi."productId") img ON img."productId" = r.id
                ORDER BY %s
                """.formatted(startsInName, startsInHay, allInHay, order, order); // img adds no clashing columns
        return jdbc.query(sql, p, (rs, i) -> new ProductHit(rs.getString("slug"), rs.getString("name"),
                rs.getString("partNumber"), rs.getString("brand"), rs.getString("categoryName"), rs.getString("imageUrl")));
    }

    /** Active categories that have something to browse, by name. */
    public List<CategoryHit> categories(String q, int limit) {
        return jdbc.query("""
                SELECT c.slug, c.name, parent.name AS "parentName",
                       CASE WHEN lower(c.name) = :exact THEN 0
                            WHEN lower(c.name) LIKE :prefix ESCAPE '\\' THEN 1 ELSE 3 END AS tier
                FROM "Category" c
                LEFT JOIN "Category" parent ON parent.id = c."parentId"
                WHERE c."isActive" = true
                  AND c.name ILIKE :contains ESCAPE '\\'
                  AND (EXISTS (SELECT 1 FROM "Product" p WHERE p."categoryId" = c.id AND p."isActive" = true)
                       OR EXISTS (SELECT 1 FROM "Category" k JOIN "Product" p ON p."categoryId" = k.id
                                  WHERE k."parentId" = c.id AND k."isActive" = true AND p."isActive" = true))
                ORDER BY tier, c."sortOrder", c.name
                LIMIT :limit
                """, params(q).addValue("limit", limit),
                (rs, i) -> new CategoryHit(rs.getString("slug"), rs.getString("name"), rs.getString("parentName")));
    }

    /** Active vehicles by model name, "Manufacturer Model", or a search alias ("splendor+", "pulsar 150"). */
    public List<VehicleHit> vehicles(String q, int limit) {
        return jdbc.query("""
                SELECT v.slug, v.name, m.name AS manufacturer, v.category::text AS category,
                       CASE WHEN lower(v.name) = :exact OR lower(m.name || ' ' || v.name) = :exact THEN 0
                            WHEN lower(v.name) LIKE :prefix ESCAPE '\\'
                              OR lower(m.name || ' ' || v.name) LIKE :prefix ESCAPE '\\' THEN 1
                            ELSE 3 END AS tier
                FROM "Vehicle" v
                JOIN "VehicleManufacturer" m ON m.id = v."manufacturerId"
                WHERE v."isActive" = true AND m."isActive" = true
                  AND (v.name ILIKE :contains ESCAPE '\\'
                       OR (m.name || ' ' || v.name) ILIKE :contains ESCAPE '\\'
                       OR EXISTS (SELECT 1 FROM unnest(v."searchAliases") AS alias WHERE alias ILIKE :contains ESCAPE '\\'))
                ORDER BY tier, v."sortOrder", v.name
                LIMIT :limit
                """, params(q).addValue("limit", limit),
                (rs, i) -> new VehicleHit(rs.getString("slug"), rs.getString("name"), rs.getString("manufacturer"),
                        rs.getString("category")));
    }
}
