package com.motoxplus.api.vendor.onboarding.overview;

import com.motoxplus.api.security.AuthenticatedUser;
import com.motoxplus.api.vendor.ApplicationView;
import com.motoxplus.api.vendor.VendorContext;
import java.util.Map;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** GET /api/v1/vendors/me/application: the signed-in vendor's application, state and checklist. */
@RestController
@ConditionalOnProperty(name = "marketplace.enabled", havingValue = "true")
public class ApplicationOverviewController {
    private final VendorContext vendors;

    public ApplicationOverviewController(VendorContext vendors) {
        this.vendors = vendors;
    }

    @GetMapping("/api/v1/vendors/me/application")
    public ResponseEntity<Map<String, Object>> get(@AuthenticationPrincipal AuthenticatedUser user) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(ApplicationView.of(vendors.current(user)));
    }
}
