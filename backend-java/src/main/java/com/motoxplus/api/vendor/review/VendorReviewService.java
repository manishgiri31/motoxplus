package com.motoxplus.api.vendor.review;

import com.motoxplus.api.common.FieldCrypto;
import com.motoxplus.api.marketplace.audit.AuditLogService;
import com.motoxplus.api.marketplace.common.PageResponse;
import com.motoxplus.api.notify.email.EmailService;
import com.motoxplus.api.notify.email.EmailTemplates;
import com.motoxplus.api.security.AuthenticatedUser;
import com.motoxplus.api.storage.StorageService;
import com.motoxplus.api.vendor.ApplicationState;
import com.motoxplus.api.vendor.ApplicationView;
import com.motoxplus.api.vendor.VendorRepository;
import com.motoxplus.api.vendor.VendorSnapshot;
import com.motoxplus.api.vendor.listings.ProductProjection;
import com.motoxplus.api.web.ApiException;
import com.motoxplus.api.web.FieldErrorsException;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Admin review of vendor applications (decision V2: every activation is a person's decision). Every read of a
 * document or bank number and every decision is written to marketplace.audit_log, which is also the vendor's
 * verification history.
 */
@Service
@ConditionalOnProperty(name = "marketplace.enabled", havingValue = "true")
public class VendorReviewService {
    private static final Logger log = LoggerFactory.getLogger(VendorReviewService.class);

    public enum Action { APPROVE, REJECT, REQUEST_CHANGES, SUSPEND, REACTIVATE, BLOCK }

    private final JdbcTemplate jdbc;
    private final TransactionTemplate tx;
    private final VendorRepository vendors;
    private final AuditLogService audit;
    private final StorageService storage;
    private final FieldCrypto crypto;
    private final EmailService email;
    private final JsonMapper json;
    private final String appUrl;
    private final ProductProjection listings;

    public VendorReviewService(JdbcTemplate jdbc, TransactionTemplate tx, VendorRepository vendors, AuditLogService audit,
                               StorageService storage, FieldCrypto crypto, EmailService email, JsonMapper json,
                               @Value("${app.public-url:https://motoxplus.com}") String appUrl, ProductProjection listings) {
        this.listings = listings;
        this.jdbc = jdbc;
        this.tx = tx;
        this.vendors = vendors;
        this.audit = audit;
        this.storage = storage;
        this.crypto = crypto;
        this.email = email;
        this.json = json;
        this.appUrl = appUrl.replaceAll("/+$", "");
    }

    // ------------------------------------------------------------------ queue

    /** Self-registered applications (legacy admin-created vendors stay on the existing vendor list). */
    public PageResponse<Map<String, Object>> list(String stateFilter, String q, int page, int size) {
        ApplicationState wanted = parseState(stateFilter);
        String query = q == null ? "" : q.trim().toLowerCase(Locale.ROOT);
        List<String> ids = jdbc.queryForList("""
                SELECT v.id FROM marketplace.vendor_application a JOIN public."Vendor" v ON v.id = a.vendor_id
                ORDER BY COALESCE(a.submitted_at, a.created_at) DESC LIMIT 2000
                """, String.class);
        List<Map<String, Object>> rows = new ArrayList<>();
        for (String id : ids) {
            VendorSnapshot v = vendors.byVendorId(id).orElse(null);
            if (v == null) continue;
            ApplicationState s = v.state();
            if (wanted != null && s != wanted) continue;
            if (!query.isEmpty() && !(contains(v.business().businessName(), query) || contains(v.fullName(), query)
                    || contains(v.email(), query) || contains(v.vendorCode(), query) || contains(v.mobile(), query))) continue;
            Map<String, Object> r = new LinkedHashMap<>();
            r.put("vendorId", v.vendorId());
            r.put("vendorCode", v.vendorCode());
            r.put("businessName", v.business().businessName());
            r.put("ownerName", v.fullName());
            r.put("email", v.email());
            r.put("mobile", v.mobile());
            r.put("state", s.name());
            r.put("city", v.business().city());
            r.put("businessState", v.business().state());
            r.put("submittedAt", ApplicationView.iso(v.application().submittedAt()));
            r.put("createdAt", com.motoxplus.api.common.Time.iso(v.createdAt()));
            rows.add(r);
        }
        int from = Math.min(page * size, rows.size());
        int to = Math.min(from + size, rows.size());
        return PageResponse.of(rows.subList(from, to), page, size, rows.size());
    }

    // ------------------------------------------------------------------ detail

    public Map<String, Object> detail(String vendorId) {
        VendorSnapshot v = load(vendorId);
        Map<String, Object> m = new LinkedHashMap<>(ApplicationView.of(v));
        m.put("vendorStatus", v.status());
        m.put("userActive", v.userActive());
        m.put("categoryNames", jdbc.query("""
                SELECT c.id, c.name, p.name AS parent, c."isActive" FROM public."VendorPartCategory" l
                JOIN public."Category" c ON c.id = l."categoryId" LEFT JOIN public."Category" p ON p.id = c."parentId"
                WHERE l."vendorId" = ? ORDER BY COALESCE(p.name, c.name), c.name
                """, (rs, i) -> {
            Map<String, Object> c = new LinkedHashMap<>();
            c.put("id", rs.getString("id"));
            c.put("name", rs.getString("name"));
            c.put("group", rs.getString("parent"));
            c.put("active", rs.getBoolean("isActive"));
            return c;
        }, vendorId));
        m.put("agreements", jdbc.query("""
                SELECT DISTINCT ON (agreement) agreement, version, accepted_at, ip FROM marketplace.vendor_agreement_acceptance
                WHERE vendor_id = ? ORDER BY agreement, accepted_at DESC
                """, (rs, i) -> Map.of("agreement", rs.getString(1), "version", rs.getString(2),
                "acceptedAt", ApplicationView.iso(rs.getObject(3, OffsetDateTime.class)), "ip", String.valueOf(rs.getString(4))), vendorId));
        m.put("checks", latestChecks(vendorId));
        m.put("history", history(vendorId));
        return m;
    }

    private List<Object> latestChecks(String vendorId) {
        List<String> details = jdbc.queryForList("""
                SELECT details::text FROM marketplace.audit_log WHERE vendor_id = ? AND action = 'vendor.application.submitted'
                ORDER BY occurred_at DESC LIMIT 1
                """, String.class, vendorId);
        if (details.isEmpty()) return List.of();
        JsonNode checks = json.readTree(details.get(0)).path("checks");
        List<Object> out = new ArrayList<>();
        checks.forEach(c -> out.add(json.convertValue(c, Map.class)));
        return out;
    }

    private List<Map<String, Object>> history(String vendorId) {
        return jdbc.query("""
                SELECT a.occurred_at, a.action, a.actor_role, u.name AS actor_name, a.details::text
                FROM marketplace.audit_log a LEFT JOIN public."User" u ON u.id = a.actor_user_id
                WHERE a.vendor_id = ? ORDER BY a.occurred_at DESC LIMIT 200
                """, (rs, i) -> {
            Map<String, Object> h = new LinkedHashMap<>();
            h.put("at", ApplicationView.iso(rs.getObject(1, OffsetDateTime.class)));
            h.put("action", rs.getString(2));
            h.put("actorRole", rs.getString(3));
            h.put("actorName", rs.getString(4));
            JsonNode d = json.readTree(rs.getString(5));
            h.put("reason", d.hasNonNull("reason") ? d.get("reason").asString() : null);
            h.put("documentType", d.hasNonNull("documentType") ? d.get("documentType").asString() : null);
            return h;
        }, vendorId);
    }

    // ------------------------------------------------------------------ sensitive reads (audited)

    public String documentUrl(AuthenticatedUser admin, String vendorId, String documentId, String ip) {
        VendorSnapshot v = load(vendorId);
        var doc = v.documents().stream().filter(d -> d.id().equals(documentId)).findFirst()
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Document not found", "NOT_FOUND", null));
        String url;
        try {
            url = storage.signedUrl(doc.key(), doc.fileUrl(), StorageService.MAX_SIGNED_SECONDS);
        } catch (StorageService.StorageUnavailableException e) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "Documents can't be opened right now", "STORAGE_UNAVAILABLE", null);
        }
        tx.executeWithoutResult(s -> audit.record(admin, "vendor.document.viewed", "vendor", vendorId, vendorId, ip,
                Map.of("documentType", doc.documentType())));
        return url;
    }

    public String revealAccountNumber(AuthenticatedUser admin, String vendorId, String ip) {
        load(vendorId);
        List<String> enc = jdbc.queryForList("SELECT account_number_enc FROM marketplace.vendor_bank_account WHERE vendor_id = ?",
                String.class, vendorId);
        if (enc.isEmpty()) throw new ApiException(HttpStatus.NOT_FOUND, "No bank account on file", "NOT_FOUND", null);
        String number;
        try {
            number = crypto.decrypt(enc.get(0));
        } catch (FieldCrypto.CryptoUnavailableException e) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "Bank details can't be read right now", "ENCRYPTION_UNAVAILABLE", null);
        }
        if (number == null) throw new ApiException(HttpStatus.CONFLICT, "Stored account number could not be decrypted", "DECRYPT_FAILED", null);
        tx.executeWithoutResult(s -> audit.record(admin, "vendor.bank.revealed", "vendor", vendorId, vendorId, ip, Map.of()));
        return number;
    }

    // ------------------------------------------------------------------ decisions

    public Map<String, Object> decide(AuthenticatedUser admin, String vendorId, Action action, String reasonIn, String ip) {
        VendorSnapshot v = load(vendorId);
        ApplicationState s = v.state();
        String reason = reasonIn == null ? "" : reasonIn.trim();
        if (Set.of(Action.REJECT, Action.REQUEST_CHANGES, Action.SUSPEND, Action.BLOCK).contains(action) && reason.length() < 5) {
            throw FieldErrorsException.invalid("reason", "Give a reason (at least 5 characters); the vendor sees it");
        }
        if (reason.length() > 1000) throw FieldErrorsException.invalid("reason", "Reason must be at most 1000 characters");

        switch (action) {
            case APPROVE -> {
                require(s, ApplicationState.UNDER_REVIEW);
                transition(admin, v, "PENDING", "APPROVED", "APPROVED", reason, "vendor.application.approved", ip, false);
                notifyQuietly(v, EmailTemplates.vendorApproved(v.fullName(), v.business().businessName(), appUrl + "/vendor/dashboard"));
            }
            case REJECT -> {
                if (!(s == ApplicationState.UNDER_REVIEW || s == ApplicationState.DRAFT || s == ApplicationState.DOCUMENTS_PENDING
                        || s == ApplicationState.PENDING_VERIFICATION)) require(s, ApplicationState.UNDER_REVIEW);
                transition(admin, v, "PENDING", "REJECTED", "REJECTED", reason, "vendor.application.rejected", ip, false);
                notifyQuietly(v, EmailTemplates.vendorRejected(v.fullName(), v.business().businessName(), reason));
            }
            case REQUEST_CHANGES -> {
                require(s, ApplicationState.UNDER_REVIEW);
                transition(admin, v, "PENDING", "PENDING", "CHANGES_REQUESTED", reason, "vendor.application.changes_requested", ip, true);
                notifyQuietly(v, EmailTemplates.vendorChangesRequested(v.fullName(), v.business().businessName(), reason,
                        appUrl + "/vendor/onboarding"));
            }
            case SUSPEND -> {
                // An auto-approved vendor is APPROVED before verifying contact details; it can be suspended then too.
                if (!(s == ApplicationState.PENDING_VERIFICATION && "APPROVED".equals(v.status()))) require(s, ApplicationState.ACTIVE);
                transition(admin, v, "APPROVED", "SUSPENDED", null, reason, "vendor.suspended", ip, false);
            }
            case REACTIVATE -> {
                require(s, ApplicationState.SUSPENDED);
                transition(admin, v, "SUSPENDED", "APPROVED", null, reason, "vendor.reactivated", ip, false);
            }
            case BLOCK -> {
                if (s == ApplicationState.BLOCKED) throw conflict("Vendor is already blocked");
                transition(admin, v, v.status(), "BLACKLISTED", null, reason, "vendor.blocked", ip, false);
            }
        }
        return detail(vendorId);
    }

    /**
     * Moves Vendor.status from {@code from} to {@code to} only if it is still {@code from} (two admins acting at once
     * cannot both succeed), records the decision on the application and appends the audit entry, atomically.
     */
    private void transition(AuthenticatedUser admin, VendorSnapshot v, String from, String to, String decision, String reason,
                            String auditAction, String ip, boolean reopen) {
        tx.executeWithoutResult(st -> {
            int n = jdbc.update("""
                    UPDATE public."Vendor" SET status = ?::"VendorStatus", "updatedAt" = (now() AT TIME ZONE 'UTC')
                    WHERE id = ? AND status = ?::"VendorStatus"
                    """, to, v.vendorId(), from);
            if (n != 1) throw conflict("This vendor changed while you were reviewing. Reload and try again.");
            // Live listings are on the storefront only while the vendor is APPROVED (suspend/block hides, reactivate restores).
            int listingsChanged = listings.syncVendor(v.vendorId());
            if (decision != null) {
                jdbc.update("""
                        UPDATE marketplace.vendor_application SET decision = ?, decision_reason = ?, decided_at = now(), decided_by = ?,
                               submitted_at = CASE WHEN ? THEN NULL ELSE submitted_at END, updated_at = now()
                        WHERE vendor_id = ?
                        """, decision, reason.isEmpty() ? null : reason, admin.userId(), reopen, v.vendorId());
            }
            Map<String, Object> details = new LinkedHashMap<>();
            details.put("from", from);
            details.put("to", to);
            if (!reason.isEmpty()) details.put("reason", reason);
            if (listingsChanged > 0) details.put("listingsVisibilityChanged", listingsChanged);
            audit.record(admin, auditAction, "vendor", v.vendorId(), v.vendorId(), ip, details);
        });
    }

    private void notifyQuietly(VendorSnapshot v, EmailTemplates.Email msg) {
        try {
            email.send(v.email(), msg.subject(), msg.html());
        } catch (RuntimeException e) {
            log.error("[VendorReview] email not sent: {}", e.getMessage());
        }
    }

    private VendorSnapshot load(String vendorId) {
        return vendors.byVendorId(vendorId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Vendor not found", "NOT_FOUND", null));
    }

    private static void require(ApplicationState actual, ApplicationState expected) {
        if (actual != expected) {
            throw conflict("Not possible while the application is " + actual.name().replace('_', ' ').toLowerCase(Locale.ROOT));
        }
    }

    private static ApiException conflict(String msg) {
        return new ApiException(HttpStatus.CONFLICT, msg, "INVALID_STATE", null);
    }

    private static ApplicationState parseState(String s) {
        if (s == null || s.isBlank() || s.equalsIgnoreCase("ALL")) return null;
        try {
            return ApplicationState.valueOf(s.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw FieldErrorsException.invalid("state", "Unknown state");
        }
    }

    private static boolean contains(String hay, String needle) {
        return hay != null && hay.toLowerCase(Locale.ROOT).contains(needle);
    }
}
