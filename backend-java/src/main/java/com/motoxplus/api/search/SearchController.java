package com.motoxplus.api.search;

import com.motoxplus.api.ratelimit.RateLimitBudgets;
import com.motoxplus.api.ratelimit.RateLimitEnforcer;
import com.motoxplus.api.search.SearchRepository.ProductHit;
import com.motoxplus.api.search.SearchRepository.Sort;
import jakarta.servlet.http.HttpServletRequest;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * GET /api/search - the site-wide search box (header overlay) and the /search results page.
 *
 * <pre>
 * q        required, 2-100 characters after cleaning (shorter returns an empty result, not an error)
 * limit    products to return, default 8, max 20
 * type     "all" (default: products + categories, vehicles and pages) | "products" (results page)
 * category category slug, products only (includes its subcategories)
 * sort     relevance (default) | name | newest
 * offset   products to skip, for "load more" on the results page
 * </pre>
 *
 * Response: {@code {query, groups: [{type, title, items: [{title, url, snippet, icon, image?}]}], hasMore}}.
 * Empty groups are left out, so "no results" is {@code groups: []}.
 */
@RestController
public class SearchController {
    static final int DEFAULT_LIMIT = 8;
    static final int MAX_LIMIT = 20;
    static final int MAX_OFFSET = 500;
    /** Secondary groups stay short so products remain the bulk of the overlay. */
    static final int SECONDARY_LIMIT = 2;

    private final SearchRepository search;
    private final RateLimitEnforcer rateLimit;

    public SearchController(SearchRepository search, RateLimitEnforcer rateLimit) {
        this.search = search;
        this.rateLimit = rateLimit;
    }

    @GetMapping("/api/search")
    public Map<String, Object> search(
            @RequestParam(name = "q", required = false) String rawQuery,
            @RequestParam(name = "limit", required = false) String rawLimit,
            @RequestParam(name = "type", required = false) String rawType,
            @RequestParam(name = "category", required = false) String rawCategory,
            @RequestParam(name = "sort", required = false) String rawSort,
            @RequestParam(name = "offset", required = false) String rawOffset,
            HttpServletRequest req) {
        String q = SearchQuery.clean(rawQuery);
        if (q.codePointCount(0, q.length()) < SearchQuery.MIN_LENGTH) return response(q, List.of(), false);

        rateLimit.enforce(req, RateLimitBudgets.SEARCH_GROUPED, null);

        int limit = clamp(parseInt(rawLimit, DEFAULT_LIMIT), 1, MAX_LIMIT);
        int offset = clamp(parseInt(rawOffset, 0), 0, MAX_OFFSET);
        boolean productsOnly = "products".equalsIgnoreCase(rawType);
        String category = slugOrNull(rawCategory);
        Sort sort = parseSort(rawSort);

        List<ProductHit> products = search.products(q, category, sort, limit + 1, offset);
        boolean hasMore = products.size() > limit;
        if (hasMore) products = products.subList(0, limit);

        List<Map<String, Object>> groups = new ArrayList<>();
        addGroup(groups, "products", "Products", products.stream().map(SearchController::productItem).toList());
        if (!productsOnly && offset == 0) {
            addGroup(groups, "categories", "Categories", search.categories(q, SECONDARY_LIMIT).stream()
                    .map(c -> item(c.name(), "/products?category=" + c.slug(),
                            c.parentName() == null ? "Browse category" : "In " + c.parentName(), "category", null))
                    .toList());
            addGroup(groups, "vehicles", "Vehicles", search.vehicles(q, SECONDARY_LIMIT).stream()
                    .map(v -> item(v.manufacturer() + " " + v.name(),
                            "/vehicles/" + v.category().toLowerCase(Locale.ROOT) + "/" + v.slug(),
                            "Parts that fit this " + vehicleNoun(v.category()), "vehicle", null))
                    .toList());
            addGroup(groups, "pages", "Help & pages", SitePages.search(q, SECONDARY_LIMIT).stream()
                    .map(p -> item(p.title(), p.url(), p.snippet(), p.icon(), null))
                    .toList());
        }
        return response(q, groups, hasMore);
    }

    private static Map<String, Object> productItem(ProductHit p) {
        List<String> bits = new ArrayList<>();
        if (p.brand() != null && !p.brand().isBlank()) bits.add(p.brand());
        bits.add("Part No. " + p.partNumber());
        if (p.categoryName() != null) bits.add(p.categoryName());
        return item(p.name(), "/products/" + p.slug(), String.join(" · ", bits), "product", p.imageUrl());
    }

    private static Map<String, Object> item(String title, String url, String snippet, String icon, String image) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("title", title);
        m.put("url", url);
        m.put("snippet", snippet);
        m.put("icon", icon);
        if (image != null) m.put("image", image);
        return m;
    }

    private static void addGroup(List<Map<String, Object>> groups, String type, String title, List<Map<String, Object>> items) {
        if (items.isEmpty()) return;
        Map<String, Object> g = new LinkedHashMap<>();
        g.put("type", type);
        g.put("title", title);
        g.put("items", items);
        groups.add(g);
    }

    private static Map<String, Object> response(String q, List<Map<String, Object>> groups, boolean hasMore) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("query", q);
        m.put("groups", groups);
        m.put("hasMore", hasMore);
        return m;
    }

    private static String vehicleNoun(String category) {
        return switch (category) {
            case "SCOOTER" -> "scooter";
            case "ELECTRIC" -> "EV";
            case "COMMERCIAL" -> "vehicle";
            default -> "bike";
        };
    }

    /** Slugs are [a-z0-9-]; anything else can't name a category, so it is ignored rather than queried. */
    private static String slugOrNull(String raw) {
        if (raw == null) return null;
        String s = raw.trim().toLowerCase(Locale.ROOT);
        return s.isEmpty() || s.length() > 120 || !s.matches("[a-z0-9-]+") ? null : s;
    }

    private static Sort parseSort(String raw) {
        if (raw == null) return Sort.RELEVANCE;
        return switch (raw.trim().toLowerCase(Locale.ROOT)) {
            case "name" -> Sort.NAME;
            case "newest" -> Sort.NEWEST;
            default -> Sort.RELEVANCE;
        };
    }

    private static int parseInt(String raw, int fallback) {
        if (raw == null) return fallback;
        try {
            return Integer.parseInt(raw.trim());
        } catch (NumberFormatException e) {
            return fallback;
        }
    }

    private static int clamp(int v, int min, int max) {
        return Math.max(min, Math.min(max, v));
    }
}
