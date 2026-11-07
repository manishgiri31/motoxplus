package com.motoxplus.api.vendor.onboarding.documents;

import com.motoxplus.api.ratelimit.RateLimitBudgets;
import com.motoxplus.api.ratelimit.RateLimitEnforcer;
import com.motoxplus.api.security.AuthenticatedUser;
import com.motoxplus.api.storage.StorageService;
import com.motoxplus.api.vendor.ApplicationView;
import com.motoxplus.api.vendor.VendorContext;
import com.motoxplus.api.web.ClientIp;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * POST   /api/v1/vendors/me/application/documents   multipart: documentType, file   -> the updated application
 * DELETE /api/v1/vendors/me/application/documents/{documentType}                   -> the updated application
 * GET    /api/v1/vendors/me/application/documents/{documentId}/url                 -> { url, expiresIn }
 */
@RestController
@ConditionalOnProperty(name = "marketplace.enabled", havingValue = "true")
public class KycDocumentsController {
    private final KycDocumentsService service;
    private final VendorContext vendors;
    private final RateLimitEnforcer rateLimit;

    public KycDocumentsController(KycDocumentsService service, VendorContext vendors, RateLimitEnforcer rateLimit) {
        this.service = service;
        this.vendors = vendors;
        this.rateLimit = rateLimit;
    }

    @PostMapping("/api/v1/vendors/me/application/documents")
    public Map<String, Object> upload(@AuthenticationPrincipal AuthenticatedUser user, @RequestParam("documentType") String documentType,
                                      @RequestParam("file") MultipartFile file, HttpServletRequest req) {
        rateLimit.enforce(req, RateLimitBudgets.DOCUMENT_UPLOAD, user == null ? null : user.userId());
        service.upload(user, documentType, file, ClientIp.resolve(req));
        return ApplicationView.of(vendors.current(user));
    }

    @DeleteMapping("/api/v1/vendors/me/application/documents/{documentType}")
    public Map<String, Object> remove(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable String documentType,
                                      HttpServletRequest req) {
        service.remove(user, documentType, ClientIp.resolve(req));
        return ApplicationView.of(vendors.current(user));
    }

    @GetMapping("/api/v1/vendors/me/application/documents/{documentId}/url")
    public ResponseEntity<Map<String, Object>> url(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable String documentId) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(Map.of("url", service.viewUrl(user, documentId), "expiresIn", StorageService.MAX_SIGNED_SECONDS));
    }
}
