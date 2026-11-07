package com.motoxplus.api.vendor.onboarding.categories;

import com.motoxplus.api.security.AuthenticatedUser;
import com.motoxplus.api.vendor.ApplicationView;
import com.motoxplus.api.vendor.VendorContext;
import com.motoxplus.api.web.ClientIp;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/** PUT /api/v1/vendors/me/application/categories { categoryIds, vehicleSegments } -> the updated application. */
@RestController
@ConditionalOnProperty(name = "marketplace.enabled", havingValue = "true")
public class SuppliedCategoriesController {
    private final SuppliedCategoriesService service;
    private final VendorContext vendors;

    public SuppliedCategoriesController(SuppliedCategoriesService service, VendorContext vendors) {
        this.service = service;
        this.vendors = vendors;
    }

    @PutMapping("/api/v1/vendors/me/application/categories")
    public Map<String, Object> save(@AuthenticationPrincipal AuthenticatedUser user, @RequestBody SuppliedCategoriesService.Request body,
                                    HttpServletRequest req) {
        service.save(user, body, ClientIp.resolve(req));
        return ApplicationView.of(vendors.current(user));
    }
}
