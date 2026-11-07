package com.motoxplus.api.vendor.onboarding.submit;

import com.motoxplus.api.security.AuthenticatedUser;
import com.motoxplus.api.vendor.ApplicationView;
import com.motoxplus.api.vendor.VendorContext;
import com.motoxplus.api.web.ClientIp;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * POST /api/v1/vendors/me/application/submit { acceptTerms, acceptVendorAgreement, declareGenuineProducts,
 * declareAccurateInformation } -> the application (state UNDER_REVIEW). 400 lists any incomplete step by check code.
 */
@RestController
@ConditionalOnProperty(name = "marketplace.enabled", havingValue = "true")
public class SubmissionController {
    private final SubmissionService service;
    private final VendorContext vendors;

    public SubmissionController(SubmissionService service, VendorContext vendors) {
        this.service = service;
        this.vendors = vendors;
    }

    @PostMapping("/api/v1/vendors/me/application/submit")
    public Map<String, Object> submit(@AuthenticationPrincipal AuthenticatedUser user, @RequestBody SubmissionService.Request body,
                                      HttpServletRequest req) {
        service.submit(user, body, ClientIp.resolve(req), req.getHeader("User-Agent"));
        return ApplicationView.of(vendors.current(user));
    }
}
