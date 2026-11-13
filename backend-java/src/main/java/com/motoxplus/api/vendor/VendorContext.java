package com.motoxplus.api.vendor;

import com.motoxplus.api.security.AuthenticatedUser;
import com.motoxplus.api.web.ApiException;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/**
 * Resolves "the vendor making this request" from the authenticated user ONLY. No vendor endpoint accepts a vendorId,
 * userId, role or status from the client; ownership comes from the JWT subject (Phase 0 audit §10).
 */
@Component
@ConditionalOnProperty(name = "marketplace.enabled", havingValue = "true")
public class VendorContext {
    private final VendorRepository vendors;

    public VendorContext(VendorRepository vendors) {
        this.vendors = vendors;
    }

    public VendorSnapshot current(AuthenticatedUser user) {
        if (user == null) throw ApiException.unauthorized();
        if (!"VENDOR".equals(user.role())) throw new ApiException(HttpStatus.FORBIDDEN, "Vendor account required", "NOT_A_VENDOR", null);
        return vendors.byUserId(user.userId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Vendor account not found", "VENDOR_NOT_FOUND", null));
    }

    /** The application can be changed: verified contact details, and not yet submitted (or an auto-approved profile still pending). */
    public VendorSnapshot editable(AuthenticatedUser user) {
        VendorSnapshot v = current(user);
        ApplicationState s = v.state();
        if (!v.emailVerified() || !v.mobileVerified()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Verify your email address and mobile number first", "VERIFICATION_REQUIRED", null);
        }
        if (!v.profileEditable()) {
            String msg = switch (s) {
                case UNDER_REVIEW -> "Your application is under review and can't be changed right now";
                case ACTIVE -> "Your account is active. Contact MotoXPlus to change registered business details";
                default -> "This application can't be changed";
            };
            throw new ApiException(HttpStatus.CONFLICT, msg, "APPLICATION_LOCKED", null);
        }
        return v;
    }

    /** An approved vendor whose login is fully verified and active: the gate for selling features (Phase 3+). */
    public VendorSnapshot active(AuthenticatedUser user) {
        VendorSnapshot v = current(user);
        if (v.state() != ApplicationState.ACTIVE || !v.userActive() || !v.emailVerified() || !v.mobileVerified()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Your vendor account is not active", "VENDOR_NOT_ACTIVE", null);
        }
        if (v.profilePending()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Complete your business profile before you start selling", "PROFILE_INCOMPLETE", null);
        }
        return v;
    }
}
