package com.motoxplus.api.catalog;

import com.motoxplus.api.catalog.PartCategoryRepository.Group;
import com.motoxplus.api.catalog.PartCategoryRepository.Node;
import com.motoxplus.api.ratelimit.RateLimitBudgets;
import com.motoxplus.api.ratelimit.RateLimitEnforcer;
import jakarta.servlet.http.HttpServletRequest;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Port of GET /api/part-categories (src/app/api/part-categories/route.ts): the automotive parts catalogue the
 * supplier application forms read. Public, because the forms are used before login.
 *
 * 200 -> { "groups": [ { "id", "name", "slug", "children": [ { "id", "name", "slug" } ] } ] }
 */
@RestController
public class PartCategoryController {
    private final PartCategoryRepository repo;
    private final RateLimitEnforcer rateLimit;

    public PartCategoryController(PartCategoryRepository repo, RateLimitEnforcer rateLimit) {
        this.repo = repo;
        this.rateLimit = rateLimit;
    }

    @GetMapping("/api/part-categories")
    public ResponseEntity<Map<String, Object>> partCategories(HttpServletRequest req) {
        rateLimit.enforce(req, RateLimitBudgets.PUBLIC_API, null);
        List<Map<String, Object>> groups = repo.tree().stream().map(PartCategoryController::groupJson).toList();
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(60, TimeUnit.SECONDS).cachePublic().staleWhileRevalidate(300, TimeUnit.SECONDS))
                .body(Map.of("groups", groups));
    }

    private static Map<String, Object> groupJson(Group g) {
        Map<String, Object> m = nodeJson(g.asNode());
        m.put("children", g.children().stream().map(PartCategoryController::nodeJson).toList());
        return m;
    }

    private static Map<String, Object> nodeJson(Node n) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", n.id());
        m.put("name", n.name());
        m.put("slug", n.slug());
        return m;
    }
}
