package com.motoxplus.api.catalog;

import com.motoxplus.api.catalog.CatalogRepository.Suggestion;
import com.motoxplus.api.ratelimit.RateLimitBudgets;
import com.motoxplus.api.ratelimit.RateLimitEnforcer;
import jakarta.servlet.http.HttpServletRequest;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Port of the public read endpoints src/app/api/categories (GET) and src/app/api/products/search.
 * Writes (POST /api/categories) are admin-only and stay on Node until the admin module is ported.
 */
@RestController
@RequestMapping("/api")
public class CatalogController {
    private static final int MIN_QUERY_LENGTH = 2;
    // The Node route has no cap; a 5,000-character "search" is never legitimate and only costs the DB.
    private static final int MAX_QUERY_LENGTH = 100;
    private static final int MAX_SUGGESTIONS = 8;
    private static final int FIELD_MATCH_LIMIT = 8;
    private static final int COMPATIBILITY_MATCH_LIMIT = 5;

    private final CatalogRepository catalog;
    private final RateLimitEnforcer rateLimit;

    public CatalogController(CatalogRepository catalog, RateLimitEnforcer rateLimit) {
        this.catalog = catalog;
        this.rateLimit = rateLimit;
    }

    @GetMapping("/categories")
    public List<Map<String, Object>> categories(HttpServletRequest req) {
        // Same PUBLIC_API budget and Redis key as the Node route, so a visitor's count is shared
        // whichever backend Nginx sends them to.
        rateLimit.enforce(req, RateLimitBudgets.PUBLIC_API, null);
        return catalog.activeCategories();
    }

    @GetMapping("/products/search")
    public Map<String, Object> search(@RequestParam(name = "q", required = false) String rawQuery, HttpServletRequest req) {
        String q = rawQuery == null ? "" : rawQuery.trim();
        if (q.length() < MIN_QUERY_LENGTH) return Map.of("suggestions", List.of());
        if (q.length() > MAX_QUERY_LENGTH) q = q.substring(0, MAX_QUERY_LENGTH);

        rateLimit.enforce(req, RateLimitBudgets.SEARCH_PUBLIC, null);

        String pattern = "%" + escapeLike(q) + "%";
        List<Suggestion> byFields = catalog.searchByFields(pattern, FIELD_MATCH_LIMIT);
        List<Suggestion> byCompatibility = catalog.searchByCompatibility(pattern, COMPATIBILITY_MATCH_LIMIT);

        String qLower = q.toLowerCase(Locale.ROOT);
        Set<String> seen = new HashSet<>();
        List<Map<String, Object>> suggestions = new ArrayList<>();

        for (Suggestion p : byFields) {
            if (!seen.add(p.id())) continue;
            String matchType = p.name().toLowerCase(Locale.ROOT).contains(qLower) ? "name"
                    : p.partNumber().toLowerCase(Locale.ROOT).contains(qLower) ? "partNumber"
                    : "brand";
            suggestions.add(toJson(p, matchType));
        }
        for (Suggestion p : byCompatibility) {
            if (!seen.add(p.id())) continue;
            suggestions.add(toJson(new Suggestion(p.id(), p.slug(), p.name(), p.partNumber(), p.brand(), p.categoryName(), null),
                    "compatibility"));
        }
        return Map.of("suggestions", suggestions.subList(0, Math.min(MAX_SUGGESTIONS, suggestions.size())));
    }

    private static Map<String, Object> toJson(Suggestion p, String matchType) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", p.id());
        m.put("slug", p.slug());
        m.put("name", p.name());
        m.put("partNumber", p.partNumber());
        m.put("brand", p.brand());
        m.put("categoryName", p.categoryName());
        if (p.imageUrl() != null) m.put("imageUrl", p.imageUrl()); // omitted, not null, like JS undefined
        m.put("matchType", matchType);
        return m;
    }

    /** Treats user input as literal text: a typed "%" or "_" must not act as a SQL wildcard. */
    static String escapeLike(String s) {
        return s.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }
}
