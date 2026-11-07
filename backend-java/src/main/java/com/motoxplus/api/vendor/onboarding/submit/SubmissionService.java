package com.motoxplus.api.vendor.onboarding.submit;

import com.motoxplus.api.common.Cuid;
import com.motoxplus.api.marketplace.audit.AuditLogService;
import com.motoxplus.api.notify.email.EmailService;
import com.motoxplus.api.notify.email.EmailTemplates;
import com.motoxplus.api.security.AuthenticatedUser;
import com.motoxplus.api.vendor.VendorContext;
import com.motoxplus.api.vendor.VendorSnapshot;
import com.motoxplus.api.web.FieldErrorsException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Review & submit: the four declarations are mandatory, every FAIL check blocks submission, and a submitted
 * application goes to UNDER_REVIEW for a person to decide (decision V2). Nothing here activates a vendor.
 */
@Service
@ConditionalOnProperty(name = "marketplace.enabled", havingValue = "true")
public class SubmissionService {
    private static final Logger log = LoggerFactory.getLogger(SubmissionService.class);
    public static final List<String> AGREEMENTS = List.of("TERMS", "VENDOR_AGREEMENT", "GENUINE_PRODUCTS", "ACCURATE_INFORMATION");

    public record Request(Boolean acceptTerms, Boolean acceptVendorAgreement, Boolean declareGenuineProducts,
                          Boolean declareAccurateInformation) {}

    private final JdbcTemplate jdbc;
    private final TransactionTemplate tx;
    private final VendorContext vendors;
    private final AuditLogService audit;
    private final EmailService email;
    private final String agreementVersion;
    private final String reviewEmail;
    private final String appUrl;

    public SubmissionService(JdbcTemplate jdbc, TransactionTemplate tx, VendorContext vendors, AuditLogService audit, EmailService email,
                             @Value("${app.vendor.agreement-version:unpublished}") String agreementVersion,
                             @Value("${app.vendor.review-email:info@motoxplus.com}") String reviewEmail,
                             @Value("${app.public-url:https://motoxplus.com}") String appUrl) {
        this.jdbc = jdbc;
        this.tx = tx;
        this.vendors = vendors;
        this.audit = audit;
        this.email = email;
        this.agreementVersion = agreementVersion == null || agreementVersion.isBlank() ? "unpublished" : agreementVersion.trim();
        this.reviewEmail = reviewEmail;
        this.appUrl = appUrl.replaceAll("/+$", "");
    }

    public List<ApplicationChecks.Check> submit(AuthenticatedUser user, Request in, String ip, String userAgent) {
        VendorSnapshot v = vendors.editable(user);

        Map<String, String> e = new LinkedHashMap<>();
        if (!Boolean.TRUE.equals(in.acceptTerms())) e.put("acceptTerms", "Accept the terms and conditions");
        if (!Boolean.TRUE.equals(in.acceptVendorAgreement())) e.put("acceptVendorAgreement", "Accept the vendor agreement");
        if (!Boolean.TRUE.equals(in.declareGenuineProducts())) e.put("declareGenuineProducts", "Confirm that you sell only genuine products");
        if (!Boolean.TRUE.equals(in.declareAccurateInformation())) e.put("declareAccurateInformation", "Confirm that your information is accurate");
        if (!e.isEmpty()) throw FieldErrorsException.invalid(e);

        List<ApplicationChecks.Check> checks = ApplicationChecks.run(v, jdbc);
        List<ApplicationChecks.Check> failed = checks.stream().filter(c -> c.result() == ApplicationChecks.Result.FAIL).toList();
        if (!failed.isEmpty()) {
            Map<String, String> fe = new LinkedHashMap<>();
            failed.forEach(c -> fe.put(c.code(), c.message()));
            throw FieldErrorsException.invalid(fe);
        }

        String ua = userAgent == null ? null : userAgent.substring(0, Math.min(userAgent.length(), 300));
        tx.executeWithoutResult(s -> {
            for (String a : AGREEMENTS) {
                jdbc.update("""
                        INSERT INTO marketplace.vendor_agreement_acceptance (id, vendor_id, user_id, agreement, version, ip, user_agent)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                        """, Cuid.next(), v.vendorId(), user.userId(), a, agreementVersion, ip, ua);
            }
            int updated = jdbc.update("""
                    UPDATE marketplace.vendor_application
                    SET submitted_at = now(), agreement_version = ?, decision = NULL, decision_reason = NULL, decided_at = NULL,
                        decided_by = NULL, updated_at = now()
                    WHERE vendor_id = ? AND submitted_at IS NULL
                    """, agreementVersion, v.vendorId());
            if (updated != 1) throw new IllegalStateException("application was submitted concurrently");
            audit.record(user, "vendor.application.submitted", "vendor", v.vendorId(), v.vendorId(), ip,
                    Map.of("agreementVersion", agreementVersion, "checks", checks.stream().map(ApplicationChecks.Check::toMap).toList()));
        });

        notifyQuietly(v);
        return checks;
    }

    private void notifyQuietly(VendorSnapshot v) {
        try {
            var toVendor = EmailTemplates.vendorApplicationSubmitted(v.fullName(), v.business().businessName());
            email.send(v.email(), toVendor.subject(), toVendor.html(), "vendor-submitted:" + v.vendorId() + ":" + System.currentTimeMillis() / 60000);
            if (reviewEmail != null && !reviewEmail.isBlank()) {
                var toAdmin = EmailTemplates.adminNewApplication(v.business().businessName(), v.vendorCode(),
                        appUrl + "/admin/vendors/applications/" + v.vendorId());
                email.send(reviewEmail, toAdmin.subject(), toAdmin.html());
            }
        } catch (RuntimeException ex) {
            log.error("[VendorSubmit] notification failed: {}", ex.getMessage());
        }
    }
}
