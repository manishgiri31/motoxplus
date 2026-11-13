package com.motoxplus.api.vendor;

/**
 * The vendor application state shown to vendors and admins. It is DERIVED, never stored: Vendor.status decides the
 * terminal states, and for a PENDING vendor the user's verification flags and the onboarding timestamps decide the
 * rest. A state therefore cannot disagree with the facts it summarises.
 *
 * Self-registered vendors (since 2026-11-14) are APPROVED at registration: PENDING_VERIFICATION -> (verify email + mobile)
 * -> ACTIVE, with the business profile completed afterwards (VendorSnapshot#profilePending).
 * Older/reopened applications: DRAFT -> (verify) -> details -> DOCUMENTS_PENDING -> submit -> UNDER_REVIEW -> admin: ACTIVE | REJECTED
 * (or "changes requested", which reopens the application as DRAFT/DOCUMENTS_PENDING). ACTIVE <-> SUSPENDED; any -> BLOCKED.
 */
public enum ApplicationState {
    DRAFT, PENDING_VERIFICATION, DOCUMENTS_PENDING, UNDER_REVIEW, ACTIVE, REJECTED, SUSPENDED, BLOCKED;

    public static ApplicationState derive(VendorSnapshot v) {
        switch (v.status()) {
            case "APPROVED":
                // Auto-approved at registration (like dealers) but email/mobile not verified yet: show the vendor the
                // verification step, not an active account. Legacy approved vendors are unaffected.
                if (v.profilePending() && (!v.emailVerified() || !v.mobileVerified())) return PENDING_VERIFICATION;
                return ACTIVE;
            case "REJECTED": return REJECTED;
            case "SUSPENDED": return SUSPENDED;
            case "BLACKLISTED": return BLOCKED;
            default: break; // PENDING
        }
        if (!v.emailVerified() || !v.mobileVerified()) return PENDING_VERIFICATION;
        if (v.application().submittedAt() != null) return UNDER_REVIEW;
        if (v.businessComplete() && v.categoriesComplete() && v.bankComplete() && !v.missingDocuments().isEmpty()) {
            return DOCUMENTS_PENDING;
        }
        return DRAFT;
    }

    /** Only these states let the vendor change the application. */
    public boolean editable() {
        return this == DRAFT || this == DOCUMENTS_PENDING;
    }
}
