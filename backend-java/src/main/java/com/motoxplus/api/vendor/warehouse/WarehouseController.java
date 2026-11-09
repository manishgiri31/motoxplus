package com.motoxplus.api.vendor.warehouse;

import com.motoxplus.api.ratelimit.RateLimitBudgets;
import com.motoxplus.api.ratelimit.RateLimitEnforcer;
import com.motoxplus.api.security.AuthenticatedUser;
import com.motoxplus.api.web.ClientIp;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * The signed-in vendor's Delhivery pickup warehouse. Ownership is the login; nothing in the path or body names a vendor.
 *
 * <pre>
 * GET  /api/v1/vendors/me/warehouse         status, details, what can be done next, prefill
 * POST /api/v1/vendors/me/warehouse         submit (or correct a definitely-rejected) warehouse and set it up on Delhivery
 * POST /api/v1/vendors/me/warehouse/retry   try the Delhivery setup again with the same name and details
 * </pre>
 */
@RestController
@ConditionalOnProperty(name = "marketplace.enabled", havingValue = "true")
public class WarehouseController {
    private static final String BASE = "/api/v1/vendors/me/warehouse";

    private final WarehouseService service;
    private final RateLimitEnforcer rateLimit;

    public WarehouseController(WarehouseService service, RateLimitEnforcer rateLimit) {
        this.service = service;
        this.rateLimit = rateLimit;
    }

    @GetMapping(BASE)
    public Map<String, Object> get(@AuthenticationPrincipal AuthenticatedUser user) {
        return service.get(user);
    }

    @PostMapping(BASE)
    public Map<String, Object> submit(@AuthenticationPrincipal AuthenticatedUser user, @RequestBody(required = false) WarehouseInput body,
                                      HttpServletRequest req) {
        limit(req, user);
        return service.submit(user, body, ClientIp.resolve(req));
    }

    @PostMapping(BASE + "/retry")
    public Map<String, Object> retry(@AuthenticationPrincipal AuthenticatedUser user, HttpServletRequest req) {
        limit(req, user);
        return service.retry(user, ClientIp.resolve(req));
    }

    private void limit(HttpServletRequest req, AuthenticatedUser user) {
        rateLimit.enforce(req, RateLimitBudgets.WAREHOUSE_WRITE, user == null ? null : user.userId());
    }
}
