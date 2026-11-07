package com.motoxplus.api.vendor.review;

import com.motoxplus.api.marketplace.common.PageResponse;
import com.motoxplus.api.marketplace.iam.PermissionService;
import com.motoxplus.api.security.AuthenticatedUser;
import com.motoxplus.api.storage.StorageService;
import com.motoxplus.api.web.ApiException;
import com.motoxplus.api.web.ClientIp;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Locale;
import java.util.Map;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Admin vendor applications. View: marketplace.vendor.view. Decisions and bank-number reveal: marketplace.vendor.approve.
 *
 * GET  /api/v1/admin/vendor-applications?state=&q=&page=&size=
 * GET  /api/v1/admin/vendor-applications/{vendorId}
 * GET  /api/v1/admin/vendor-applications/{vendorId}/documents/{documentId}/url
 * GET  /api/v1/admin/vendor-applications/{vendorId}/bank-account
 * POST /api/v1/admin/vendor-applications/{vendorId}/{approve|reject|request-changes|suspend|reactivate|block}  { reason }
 */
@RestController
@ConditionalOnProperty(name = "marketplace.enabled", havingValue = "true")
public class VendorReviewController {
    private static final String VIEW = "marketplace.vendor.view";
    private static final String DECIDE = "marketplace.vendor.approve";

    public record DecisionRequest(String reason) {}

    private final VendorReviewService service;
    private final PermissionService perms;

    public VendorReviewController(VendorReviewService service, PermissionService perms) {
        this.service = service;
        this.perms = perms;
    }

    @GetMapping("/api/v1/admin/vendor-applications")
    public PageResponse<Map<String, Object>> list(@AuthenticationPrincipal AuthenticatedUser user, @RequestParam(required = false) String state,
                                                  @RequestParam(required = false) String q, @RequestParam(required = false) Integer page,
                                                  @RequestParam(required = false) Integer size) {
        perms.require(user, VIEW);
        return service.list(state, q, PageResponse.clampPage(page), PageResponse.clampSize(size));
    }

    @GetMapping("/api/v1/admin/vendor-applications/{vendorId}")
    public ResponseEntity<Map<String, Object>> detail(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable String vendorId) {
        perms.require(user, VIEW);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.detail(vendorId));
    }

    @GetMapping("/api/v1/admin/vendor-applications/{vendorId}/documents/{documentId}/url")
    public ResponseEntity<Map<String, Object>> document(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable String vendorId,
                                                        @PathVariable String documentId, HttpServletRequest req) {
        perms.require(user, VIEW);
        String url = service.documentUrl(user, vendorId, documentId, ClientIp.resolve(req));
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(Map.of("url", url, "expiresIn", StorageService.MAX_SIGNED_SECONDS));
    }

    @GetMapping("/api/v1/admin/vendor-applications/{vendorId}/bank-account")
    public ResponseEntity<Map<String, Object>> bank(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable String vendorId,
                                                    HttpServletRequest req) {
        perms.require(user, DECIDE);
        String number = service.revealAccountNumber(user, vendorId, ClientIp.resolve(req));
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(Map.of("accountNumber", number));
    }

    @PostMapping("/api/v1/admin/vendor-applications/{vendorId}/{action}")
    public Map<String, Object> decide(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable String vendorId, @PathVariable String action,
                                      @RequestBody(required = false) DecisionRequest body, HttpServletRequest req) {
        perms.require(user, DECIDE);
        VendorReviewService.Action a;
        try {
            a = VendorReviewService.Action.valueOf(action.replace('-', '_').toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Unknown action", "NOT_FOUND", null);
        }
        return service.decide(user, vendorId, a, body == null ? null : body.reason(), ClientIp.resolve(req));
    }
}
