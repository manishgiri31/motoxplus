package com.motoxplus.api.vendor;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.List;

/** Everything about one vendor's account and application, read in one go (see VendorRepository). */
public record VendorSnapshot(
        String vendorId,
        String userId,
        String vendorCode,
        String status,               // public."VendorStatus": PENDING | APPROVED | REJECTED | SUSPENDED | BLACKLISTED
        String fullName,             // User.name
        String email,
        String mobile,
        boolean emailVerified,
        boolean mobileVerified,
        boolean userActive,
        LocalDateTime createdAt,
        Business business,
        List<String> categoryIds,
        List<String> vehicleSegments,
        Bank bank,                   // null until saved
        List<Document> documents,
        Application application) {

    public record Business(String businessName, String businessType, String pan, String gstin,
                           String address, String state, String city, String pincode) {}

    public record Bank(String accountHolder, String bankName, String ifsc, String last4) {}

    public record Document(String id, String documentType, String fileName, int fileSize, String key, String fileUrl,
                           LocalDateTime uploadedAt) {}

    public record Application(OffsetDateTime businessSavedAt, OffsetDateTime categoriesSavedAt, OffsetDateTime submittedAt,
                              String agreementVersion, String decision, String decisionReason, OffsetDateTime decidedAt) {
        public static final Application EMPTY = new Application(null, null, null, null, null, null, null);
    }

    public boolean businessComplete() {
        return application.businessSavedAt() != null && business.businessType() != null && !business.businessName().isBlank();
    }

    public boolean categoriesComplete() {
        return application.categoriesSavedAt() != null && !categoryIds.isEmpty() && !vehicleSegments.isEmpty();
    }

    public boolean bankComplete() { return bank != null; }

    public boolean hasGstin() { return business.gstin() != null && !business.gstin().isBlank(); }

    public List<String> missingDocuments() {
        return VendorDocuments.required(hasGstin()).stream()
                .filter(t -> documents.stream().noneMatch(d -> d.documentType().equals(t)))
                .toList();
    }

    public ApplicationState state() { return ApplicationState.derive(this); }

    /**
     * Self-registered vendors are approved automatically (owner decision 2026-11-14, same as dealers): the account is
     * APPROVED from the start and the business profile (details, categories, bank, documents, declarations) is filled
     * in afterwards. Until it is submitted the vendor can use the dashboard but cannot sell. Vendors created by an
     * admin or approved through the older review flow have no such pending profile.
     */
    public boolean profilePending() {
        return "APPROVED".equals(status) && "APPROVED".equals(application.decision()) && application.submittedAt() == null;
    }

    /** The vendor may change the application / business profile right now. */
    public boolean profileEditable() {
        return state().editable() || (profilePending() && emailVerified && mobileVerified);
    }
}
