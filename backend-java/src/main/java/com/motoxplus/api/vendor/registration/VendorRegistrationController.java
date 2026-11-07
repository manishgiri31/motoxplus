package com.motoxplus.api.vendor.registration;

import com.motoxplus.api.ratelimit.RateLimitBudgets;
import com.motoxplus.api.ratelimit.RateLimitEnforcer;
import com.motoxplus.api.web.ClientIp;
import jakarta.servlet.http.HttpServletRequest;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * POST /api/v1/vendors/register (public). Creates the vendor login and sends the email code.
 *
 * 201 -> { userId, vendorId, status: "PENDING_VERIFICATION", emailVerificationRequired, mobileVerificationRequired }
 * 400 -> VALIDATION_FAILED + fieldErrors · 409 -> CONFLICT + fieldErrors (email / mobile) · 429 -> RATE_LIMITED
 */
@RestController
@ConditionalOnProperty(name = "marketplace.enabled", havingValue = "true")
public class VendorRegistrationController {
    private final VendorRegistrationService service;
    private final RateLimitEnforcer rateLimit;

    public VendorRegistrationController(VendorRegistrationService service, RateLimitEnforcer rateLimit) {
        this.service = service;
        this.rateLimit = rateLimit;
    }

    @PostMapping("/api/v1/vendors/register")
    public ResponseEntity<Map<String, Object>> register(@RequestBody VendorRegistrationService.Request body, HttpServletRequest req) {
        String id = body.email() == null ? null : body.email().trim().toLowerCase(Locale.ROOT);
        rateLimit.enforce(req, RateLimitBudgets.REGISTER, id == null || id.isEmpty() ? null : id);
        var r = service.register(body, ClientIp.resolve(req));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("userId", r.userId());
        out.put("vendorId", r.vendorId());
        out.put("email", r.email());
        out.put("status", "PENDING_VERIFICATION");
        out.put("emailVerificationRequired", true);
        out.put("mobileVerificationRequired", true);
        return ResponseEntity.status(HttpStatus.CREATED).body(out);
    }
}
