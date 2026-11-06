package com.motoxplus.api.catalog;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * The automotive parts catalogue suppliers choose from (port of src/lib/catalog/part-categories.ts).
 *
 * It is the product "Category" table seen as a two-level tree: an active top-level category with at least one
 * active subcategory is a group; its active subcategories are the options. Admin-managed, never hard-coded.
 */
@Repository
public class PartCategoryRepository {
    private final NamedParameterJdbcTemplate jdbc;

    public PartCategoryRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public record Node(String id, String name, String slug) {}

    public record Group(String id, String name, String slug, List<Node> children) {
        public Node asNode() { return new Node(id, name, slug); }
    }

    private record Row(String groupId, String groupName, String groupSlug, String id, String name, String slug) {}

    /** Groups and their subcategories, both in (sortOrder, name) order - the same order Prisma returns. */
    public List<Group> tree() {
        List<Row> rows = jdbc.query("""
                SELECT g.id AS gid, g.name AS gname, g.slug AS gslug, k.id, k.name, k.slug
                FROM "Category" g
                JOIN "Category" k ON k."parentId" = g.id AND k."isActive" = true
                WHERE g."isActive" = true AND g."parentId" IS NULL
                ORDER BY g."sortOrder" ASC, g.name ASC, g.id ASC, k."sortOrder" ASC, k.name ASC
                """, Map.of(), (rs, i) -> new Row(rs.getString("gid"), rs.getString("gname"), rs.getString("gslug"),
                rs.getString("id"), rs.getString("name"), rs.getString("slug")));

        Map<String, Group> groups = new LinkedHashMap<>();
        for (Row r : rows) {
            groups.computeIfAbsent(r.groupId(), id -> new Group(id, r.groupName(), r.groupSlug(), new ArrayList<>()))
                    .children().add(new Node(r.id(), r.name(), r.slug()));
        }
        return List.copyOf(groups.values());
    }
}
