package com.motoxplus.api.vendor.listings;

import com.motoxplus.api.marketplace.common.PageResponse;
import com.motoxplus.api.ratelimit.RateLimitBudgets;
import com.motoxplus.api.ratelimit.RateLimitEnforcer;
import com.motoxplus.api.security.AuthenticatedUser;
import com.motoxplus.api.web.ClientIp;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Map;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * The signed-in vendor's own listings. No path or body names a vendor: ownership is the login.
 *
 * <pre>
 * GET  /api/v1/vendors/me/listings/overview              tab counts, categories, commission rate, limits
 * GET  /api/v1/vendors/me/listings?status=&q=&page=&size= page of listings
 * POST /api/v1/vendors/me/listings                       create a draft            -> 201 listing
 * GET  /api/v1/vendors/me/listings/{id}                  one listing (with publish checklist)
 * PUT  /api/v1/vendors/me/listings/{id}                  save edits (live listings stay live and update at once)
 * POST /api/v1/vendors/me/listings/{id}/publish          go live if complete, else 400 LISTING_INCOMPLETE + fieldErrors
 * POST /api/v1/vendors/me/listings/{id}/unpublish        take off the storefront
 * GET  /api/v1/vendors/me/listings/vehicles?q=           fitment picker typeahead
 * </pre>
 */
@RestController
@ConditionalOnProperty(name = "marketplace.enabled", havingValue = "true")
public class ListingController {
    private static final String BASE = "/api/v1/vendors/me/listings";

    private final ListingService service;
    private final RateLimitEnforcer rateLimit;

    public ListingController(ListingService service, RateLimitEnforcer rateLimit) {
        this.service = service;
        this.rateLimit = rateLimit;
    }

    @GetMapping(BASE + "/overview")
    public Map<String, Object> overview(@AuthenticationPrincipal AuthenticatedUser user) {
        return service.overview(user);
    }

    @GetMapping(BASE)
    public PageResponse<Map<String, Object>> list(@AuthenticationPrincipal AuthenticatedUser user,
                                                  @RequestParam(required = false) String status, @RequestParam(required = false) String q,
                                                  @RequestParam(required = false) Integer page, @RequestParam(required = false) Integer size) {
        return service.list(user, status, q, PageResponse.clampPage(page), PageResponse.clampSize(size));
    }

    @GetMapping(BASE + "/vehicles")
    public List<ListingRepository.VehicleOption> vehicles(@AuthenticationPrincipal AuthenticatedUser user,
                                                          @RequestParam(required = false) String q) {
        return service.vehicles(user, q);
    }

    @PostMapping(BASE)
    public ResponseEntity<Map<String, Object>> create(@AuthenticationPrincipal AuthenticatedUser user, @RequestBody(required = false) ListingInput body,
                                                      HttpServletRequest req) {
        limit(req, user);
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(user, body, ClientIp.resolve(req)));
    }

    @GetMapping(BASE + "/{id}")
    public Map<String, Object> get(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable String id) {
        return service.get(user, id);
    }

    @PutMapping(BASE + "/{id}")
    public Map<String, Object> update(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable String id,
                                      @RequestBody(required = false) ListingInput body, HttpServletRequest req) {
        limit(req, user);
        return service.update(user, id, body, ClientIp.resolve(req));
    }

    @PostMapping(BASE + "/{id}/publish")
    public Map<String, Object> publish(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable String id, HttpServletRequest req) {
        limit(req, user);
        return service.publish(user, id, ClientIp.resolve(req));
    }

    @PostMapping(BASE + "/{id}/unpublish")
    public Map<String, Object> unpublish(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable String id, HttpServletRequest req) {
        limit(req, user);
        return service.unpublish(user, id, ClientIp.resolve(req));
    }

    private void limit(HttpServletRequest req, AuthenticatedUser user) {
        rateLimit.enforce(req, RateLimitBudgets.LISTING_WRITE, user == null ? null : user.userId());
    }
}
