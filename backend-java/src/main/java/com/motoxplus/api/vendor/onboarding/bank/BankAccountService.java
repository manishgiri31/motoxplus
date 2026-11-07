package com.motoxplus.api.vendor.onboarding.bank;

import com.motoxplus.api.common.FieldCrypto;
import com.motoxplus.api.common.Time;
import com.motoxplus.api.marketplace.audit.AuditLogService;
import com.motoxplus.api.security.AuthenticatedUser;
import com.motoxplus.api.vendor.VendorContext;
import com.motoxplus.api.vendor.VendorSnapshot;
import com.motoxplus.api.web.ApiException;
import com.motoxplus.api.web.FieldErrorsException;
import java.sql.Timestamp;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Onboarding step: payout bank account. The number is encrypted (FieldCrypto, Node-compatible) and only its last
 * four digits are ever shown back. Bank name and IFSC are not secret and are mirrored onto public."Vendor" so the
 * existing admin vendor page shows them; the legacy plaintext Vendor.accountNumber column is never written.
 */
@Service
@ConditionalOnProperty(name = "marketplace.enabled", havingValue = "true")
public class BankAccountService {
    private static final Pattern IFSC = Pattern.compile("^[A-Z]{4}0[A-Z0-9]{6}$");
    private static final Pattern ACCOUNT = Pattern.compile("^[0-9]{9,18}$");

    public record Request(String accountHolder, String bankName, String accountNumber, String ifsc) {}

    private final JdbcTemplate jdbc;
    private final VendorContext vendors;
    private final FieldCrypto crypto;
    private final AuditLogService audit;

    public BankAccountService(JdbcTemplate jdbc, VendorContext vendors, FieldCrypto crypto, AuditLogService audit) {
        this.jdbc = jdbc;
        this.vendors = vendors;
        this.crypto = crypto;
        this.audit = audit;
    }

    @Transactional
    public void save(AuthenticatedUser user, Request in, String ip) {
        VendorSnapshot v = vendors.editable(user);

        String holder = trim(in.accountHolder());
        String bank = trim(in.bankName());
        String number = in.accountNumber() == null ? "" : in.accountNumber().replaceAll("\\s", "");
        String ifsc = trim(in.ifsc()).toUpperCase(Locale.ROOT);

        Map<String, String> e = new LinkedHashMap<>();
        if (holder.length() < 2) e.put("accountHolder", "Account holder name is required");
        else if (holder.length() > 120) e.put("accountHolder", "Account holder name must be at most 120 characters");
        if (bank.length() < 2) e.put("bankName", "Bank name is required");
        else if (bank.length() > 100) e.put("bankName", "Bank name must be at most 100 characters");
        if (!ACCOUNT.matcher(number).matches()) e.put("accountNumber", "Account number must be 9 to 18 digits");
        if (ifsc.isEmpty()) e.put("ifsc", "IFSC is required");
        else if (!IFSC.matcher(ifsc).matches()) e.put("ifsc", "IFSC looks like HDFC0001234");
        if (!e.isEmpty()) throw FieldErrorsException.invalid(e);

        if (!crypto.isConfigured()) {
            // Never store a bank account number in plaintext.
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "Bank details can't be saved right now. Please try again later.",
                    "ENCRYPTION_UNAVAILABLE", null);
        }

        String last4 = number.substring(number.length() - 4);
        jdbc.update("""
                INSERT INTO marketplace.vendor_bank_account (vendor_id, account_holder, bank_name, ifsc, account_number_enc, account_last4)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT (vendor_id) DO UPDATE SET account_holder = EXCLUDED.account_holder, bank_name = EXCLUDED.bank_name,
                    ifsc = EXCLUDED.ifsc, account_number_enc = EXCLUDED.account_number_enc, account_last4 = EXCLUDED.account_last4,
                    updated_at = now()
                """, v.vendorId(), holder, bank, ifsc, crypto.encrypt(number), last4);
        jdbc.update("UPDATE public.\"Vendor\" SET \"bankName\" = ?, \"ifscCode\" = ?, \"updatedAt\" = ? WHERE id = ?",
                bank, ifsc, Timestamp.valueOf(Time.utcNow()), v.vendorId());
        audit.record(user, "vendor.application.bank_saved", "vendor", v.vendorId(), v.vendorId(), ip,
                Map.of("ifsc", ifsc, "last4", last4));
    }

    private static String trim(String s) { return s == null ? "" : s.trim().replaceAll("\\s+", " "); }
}
