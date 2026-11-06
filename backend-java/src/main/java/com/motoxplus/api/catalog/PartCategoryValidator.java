package com.motoxplus.api.catalog;

import com.motoxplus.api.catalog.PartCategoryRepository.Group;
import com.motoxplus.api.catalog.PartCategoryRepository.Node;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Component;

/**
 * Server-side check for the category ids a vendor/seller application sends (port of validatePartCategoryIds in
 * src/lib/catalog/part-categories.ts; messages are identical because the web UI shows them).
 *
 * Reads the LIVE tree, so a category an admin just deactivated cannot be chosen, and returns the ids normalised:
 * tree order, no duplicates, no subcategory alongside its own group, a fully selected group collapsed to its id.
 * Use it from every registration endpoint (procurement and marketplace) instead of re-implementing the rules.
 */
@Component
public class PartCategoryValidator {
    public static final int MAX_IDS = 200;

    private final PartCategoryRepository repo;

    public PartCategoryValidator(PartCategoryRepository repo) {
        this.repo = repo;
    }

    public sealed interface Result permits Valid, Invalid {}
    public record Valid(List<String> ids) implements Result {}
    public record Invalid(String error) implements Result {}

    public Result validate(Collection<String> ids) {
        if (ids == null || ids.isEmpty()) return new Invalid("Select at least one automotive parts category");
        if (ids.size() > MAX_IDS) return new Invalid("Too many categories selected");

        List<Group> tree = repo.tree();
        Set<String> known = new HashSet<>();
        for (Group g : tree) {
            known.add(g.id());
            for (Node c : g.children()) known.add(c.id());
        }
        for (String id : ids) {
            if (!known.contains(id)) {
                return new Invalid("One or more selected categories are no longer available. Refresh and try again.");
            }
        }
        return new Valid(normalize(tree, ids));
    }

    static List<String> normalize(List<Group> tree, Collection<String> ids) {
        Set<String> wanted = new LinkedHashSet<>(ids);
        List<String> out = new ArrayList<>();
        for (Group g : tree) {
            boolean allChildren = !g.children().isEmpty() && g.children().stream().allMatch(c -> wanted.contains(c.id()));
            if (wanted.contains(g.id()) || allChildren) {
                out.add(g.id());
                continue;
            }
            for (Node c : g.children()) if (wanted.contains(c.id())) out.add(c.id());
        }
        return out;
    }
}
