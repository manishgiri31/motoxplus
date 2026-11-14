package com.motoxplus.api.vendor.registration;

import com.motoxplus.api.auth.PasswordPolicy;
import com.motoxplus.api.auth.otp.OtpService;
import com.motoxplus.api.auth.otp.OtpService.OtpType;
import com.motoxplus.api.common.Cuid;
import com.motoxplus.api.common.PhoneUtil;
import com.motoxplus.api.common.Time;
import com.motoxplus.api.marketplace.audit.AuditLogService;
import com.motoxplus.api.notify.email.EmailService;
import com.motoxplus.api.notify.email.EmailTemplates;
import com.motoxplus.api.security.AuthenticatedUser;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.sql.Timestamp;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import com.motoxplus.api.web.ApiException;
import com.motoxplus.api.web.FieldErrorsException;
import java.util.Set;
import org.springframework.http.HttpStatus;

/**
 * Step 1 of vendor onboarding: the login account. Mirrors the dealer flow (src/app/api/dealer/register/route.ts):
 * same uniqueness rules, same password policy and bcrypt cost, email OTP sent right away.
 *
 * Like a dealer, a self-registered vendor is approved automatically (owner decision 2026-11-14): the Vendor row starts
 * APPROVED and the application records an automatic APPROVED decision. Email and mobile verification still gate the
 * portal (middleware + VendorContext), and selling stays locked until the business profile is submitted
 * ({@link com.motoxplus.api.vendor.VendorSnapshot#profilePending()}). Admins can suspend or block at any time.
 */
@Service
@ConditionalOnProperty(name = "marketplace.enabled", havingValue = "true")
public class VendorRegistrationService {
    private static final Logger log = LoggerFactory.getLogger(VendorRegistrationService.class);
    private static final BCryptPasswordEncoder BCRYPT = new BCryptPasswordEncoder(12);
    private static final Pattern EMAIL = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
    private static final SecureRandom RANDOM = new SecureRandom();

    /** decided_by value for the automatic approval given at registration (no admin user involved). */
    public static final String AUTO_APPROVER = "system:auto-approval";

    /** businessName is optional (the one-step signup asks for it); it pre-fills the business profile. */
    public record Request(String fullName, String mobile, String email, String password, String businessName) {
        public Request(String fullName, String mobile, String email, String password) {
            this(fullName, mobile, email, password, null);
        }
    }

    public record Registered(String userId, String vendorId, String email) {}

    private final JdbcTemplate jdbc;
    private final TransactionTemplate tx;
    private final AuditLogService audit;
    private final OtpService otp;
    private final EmailService email;
    private final String appUrl;

    public VendorRegistrationService(JdbcTemplate jdbc, TransactionTemplate tx, AuditLogService audit, OtpService otp,
                                     EmailService email, @Value("${app.public-url:https://motoxplus.com}") String appUrl) {
        this.jdbc = jdbc;
        this.tx = tx;
        this.audit = audit;
        this.otp = otp;
        this.email = email;
        this.appUrl = appUrl.replaceAll("/+$", "");
    }

    public Registered register(Request in, String ip) {
        String name = in.fullName() == null ? "" : in.fullName().trim().replaceAll("\\s+", " ");
        String mail = in.email() == null ? "" : in.email().trim().toLowerCase(Locale.ROOT);
        String mobile = PhoneUtil.normalizeIndianMobile(in.mobile());
        String business = in.businessName() == null ? "" : in.businessName().trim().replaceAll("\\s+", " ");

        Map<String, String> errors = new LinkedHashMap<>();
        if (name.length() < 2) errors.put("fullName", "Full name is required");
        else if (name.length() > 100) errors.put("fullName", "Full name must be at most 100 characters");
        if (business.length() > 120) errors.put("businessName", "Business name must be at most 120 characters");
        if (mobile == null) errors.put("mobile", "Enter a valid 10-digit Indian mobile number");
        if (mail.isEmpty()) errors.put("email", "Email address is required");
        else if (mail.length() > 254 || !EMAIL.matcher(mail).matches()) errors.put("email", "Enter a valid email address");
        String pw = PasswordPolicy.validate(in.password(), mail, name);
        if (pw != null) errors.put("password", pw);
        if (!errors.isEmpty()) throw FieldErrorsException.invalid(errors);

        // Same wording as the dealer/supplier routes (this does reveal that an account exists, as they do).
        if (exists("SELECT 1 FROM public.\"User\" WHERE email = ?", mail) || exists("SELECT 1 FROM public.\"Vendor\" WHERE email = ?", mail)) {
            throw FieldErrorsException.conflict("email", "Email already registered");
        }
        if (exists("SELECT 1 FROM public.\"User\" WHERE \"mobileNumber\" = ?", mobile)) {
            throw FieldErrorsException.conflict("mobile", "Mobile number already registered");
        }

        String hash = BCRYPT.encode(in.password());
        String userId = Cuid.next();
        String vendorId = Cuid.next();
        try {
            tx.executeWithoutResult(s -> {
                Timestamp now = Timestamp.valueOf(Time.utcNow());
                jdbc.update("""
                        INSERT INTO public."User" (id, name, email, password, role, "mobileNumber", "mobileVerified", "isActive", "createdAt", "updatedAt")
                        VALUES (?, ?, ?, ?, 'VENDOR'::"UserRole", ?, false, true, ?, ?)
                        """, userId, name, mail, hash, mobile, now, now);
                insertVendorProfile(vendorId, userId, name, mail, mobile, now);
                if (!business.isEmpty()) {
                    jdbc.update("UPDATE public.\"Vendor\" SET \"companyName\" = ? WHERE id = ?", business, vendorId);
                }
                audit.record(new AuthenticatedUser(userId, mail, "VENDOR", null), "vendor.registered", "vendor", vendorId, vendorId, ip,
                        Map.of("channel", "web", "approval", "automatic"));
            });
        } catch (DuplicateKeyException e) {
            // Lost a race with a concurrent registration of the same email/mobile.
            String msg = String.valueOf(e.getMostSpecificCause().getMessage());
            if (msg.contains("mobileNumber")) throw FieldErrorsException.conflict("mobile", "Mobile number already registered");
            throw FieldErrorsException.conflict("email", "Email already registered");
        }

        sendVerificationEmail(userId, name, mail);
        return new Registered(userId, vendorId, mail);
    }

    /**
     * One login, several profiles: a signed-in dealer or customer adds a vendor profile to the SAME account (same
     * email, mobile, password and verification). The account's role is not changed here; the web app switches the
     * active workspace afterwards (src/app/api/auth/switch-workspace). Idempotent: an account that already has a
     * vendor profile gets that one back.
     */
    public Registered attach(AuthenticatedUser user, String ip) {
        if (user == null) throw ApiException.unauthorized();
        var rows = jdbc.queryForList("""
                SELECT u.name, u.email, u."mobileNumber", u.role::text AS role, u."isActive", v.id AS vendor_id
                FROM public."User" u LEFT JOIN public."Vendor" v ON v."userId" = u.id
                WHERE u.id = ?
                """, user.userId());
        if (rows.isEmpty()) throw ApiException.unauthorized();
        Map<String, Object> u = rows.get(0);
        if (!Boolean.TRUE.equals(u.get("isActive"))) {
            throw new ApiException(HttpStatus.FORBIDDEN, "This account is not active", "ACCOUNT_INACTIVE", null);
        }
        // Both the signed-in role and the stored one: staff/admin sessions never get a vendor profile this way.
        if (!Set.of("DEALER", "CUSTOMER").contains(user.role()) || !Set.of("DEALER", "CUSTOMER").contains(String.valueOf(u.get("role")))) {
            throw new ApiException(HttpStatus.FORBIDDEN,
                    "Only dealer and customer accounts can add a vendor profile", "NOT_ELIGIBLE", null);
        }
        if (u.get("vendor_id") != null) return new Registered(user.userId(), (String) u.get("vendor_id"), (String) u.get("email"));
        String mail = (String) u.get("email");
        if (exists("SELECT 1 FROM public.\"Vendor\" WHERE email = ?", mail)) {
            // A vendor record created by an admin (no login) already uses this email; linking it is a support task.
            throw FieldErrorsException.conflict("email", "This email already belongs to another vendor record. Write to info@motoxplus.com to link it");
        }
        String name = u.get("name") == null ? "" : ((String) u.get("name")).trim();
        String mobile = u.get("mobileNumber") == null ? "" : (String) u.get("mobileNumber");
        String vendorId = Cuid.next();
        try {
            tx.executeWithoutResult(s -> {
                insertVendorProfile(vendorId, user.userId(), name, mail, mobile, Timestamp.valueOf(Time.utcNow()));
                audit.record(user, "vendor.registered", "vendor", vendorId, vendorId, ip,
                        Map.of("channel", "existing-account", "fromRole", String.valueOf(u.get("role")), "approval", "automatic"));
            });
        } catch (DuplicateKeyException e) {
            // Two tabs at once: the other one created it.
            return jdbc.queryForList("SELECT id FROM public.\"Vendor\" WHERE \"userId\" = ?", String.class, user.userId()).stream()
                    .findFirst().map(id -> new Registered(user.userId(), id, mail)).orElseThrow(() -> e);
        }
        return new Registered(user.userId(), vendorId, mail);
    }

    /** Vendor row (auto-approved, like dealers) + its application. Business fields start empty; onboarding fills them. */
    private void insertVendorProfile(String vendorId, String userId, String name, String mail, String mobile, Timestamp now) {
        // Business fields are NOT NULL in the legacy table; they start empty and the onboarding steps fill them.
        jdbc.update("""
                INSERT INTO public."Vendor" (id, "userId", "vendorCode", "companyName", "ownerName", email, phone, city, state,
                                             status, "createdAt", "updatedAt")
                VALUES (?, ?, ?, '', ?, ?, ?, '', '', 'APPROVED'::"VendorStatus", ?, ?)
                """, vendorId, userId, uniqueVendorCode(), name, mail, mobile, now, now);
        jdbc.update("""
                INSERT INTO marketplace.vendor_application (vendor_id, decision, decided_at, decided_by)
                VALUES (?, 'APPROVED', now(), ?)
                """, vendorId, AUTO_APPROVER);
    }

    /** Like Node: a failed email never fails the registration; /verify-email can resend the code. */
    private void sendVerificationEmail(String userId, String name, String mail) {
        try {
            String code = otp.create(userId, OtpType.EMAIL_VERIFICATION);
            String url = appUrl + "/verify-email?userId=" + URLEncoder.encode(userId, StandardCharsets.UTF_8);
            var msg = EmailTemplates.vendorVerifyEmail(name, url, code);
            email.send(mail, msg.subject(), msg.html(), "vendor-verify:" + userId);
        } catch (RuntimeException e) {
            log.error("[VendorRegister] verification email not sent: {}", e.getMessage());
        }
    }

    /** Same shape as generateVendorCode() in src/lib/utils.ts ("VND" + 6 time digits + 2 random), retried on collision. */
    private String uniqueVendorCode() {
        for (int i = 0; i < 10; i++) {
            String ms = Long.toString(System.currentTimeMillis());
            String code = "VND" + ms.substring(ms.length() - 6) + String.format("%02d", RANDOM.nextInt(100));
            if (!exists("SELECT 1 FROM public.\"Vendor\" WHERE \"vendorCode\" = ?", code)) return code;
        }
        throw new IllegalStateException("could not allocate a vendor code");
    }

    private boolean exists(String sql, Object arg) {
        return !jdbc.queryForList(sql, Integer.class, arg).isEmpty();
    }
}
