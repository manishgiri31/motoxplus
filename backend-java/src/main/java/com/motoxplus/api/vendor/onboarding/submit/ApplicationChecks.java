package com.motoxplus.api.vendor.onboarding.submit;

import com.motoxplus.api.vendor.VendorSnapshot;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Automated checks run when a vendor submits (decision V2: they INFORM the manual review, they never approve).
 * FAIL = the application is incomplete and cannot be submitted; WARN = something the reviewer must look at
 * (possible duplicate or suspicious account); PASS = checked and fine.
 */
public final class ApplicationChecks {
    private ApplicationChecks() {}

    public enum Result { PASS, WARN, FAIL }

    public record Check(String code, Result result, String message) {
        public Map<String, Object> toMap() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("code", code);
            m.put("result", result.name());
            m.put("message", message);
            return m;
        }
    }

    public static List<Check> run(VendorSnapshot v, JdbcTemplate jdbc) {
        List<Check> out = new ArrayList<>();
        out.add(v.emailVerified() && v.mobileVerified()
                ? pass("CONTACT_VERIFIED", "Email address and mobile number verified")
                : fail("CONTACT_VERIFIED", "Verify your email address and mobile number"));
        out.add(v.businessComplete() ? pass("BUSINESS_DETAILS", "Business details complete") : fail("BUSINESS_DETAILS", "Add your business details"));
        out.add(v.categoriesComplete() ? pass("PARTS_CATEGORIES", "Parts categories and vehicle segments selected")
                : fail("PARTS_CATEGORIES", "Select the parts you manufacture or supply"));
        out.add(v.bankComplete() ? pass("BANK_ACCOUNT", "Bank account added") : fail("BANK_ACCOUNT", "Add your bank account"));
        // Documents are optional; the reviewer only sees whether any were given.
        out.add(v.documents().isEmpty() ? warn("DOCUMENTS", "No KYC documents uploaded (optional)")
                : pass("DOCUMENTS", v.documents().size() + " KYC document(s) uploaded"));
        if (!v.businessComplete()) return out; // the remaining checks need business details

        String pan = v.business().pan();
        String gstin = v.business().gstin();
        if (v.hasGstin()) {
            out.add(gstin.substring(2, 12).equals(pan)
                    ? pass("GSTIN_MATCHES_PAN", "GSTIN belongs to the PAN entered")
                    : warn("GSTIN_MATCHES_PAN", "GSTIN does not contain the PAN entered"));
        } else {
            out.add(warn("NO_GSTIN", "No GSTIN given: confirm the vendor is not required to register for GST"));
        }

        List<String> samePan = jdbc.queryForList(
                "SELECT \"vendorCode\" FROM public.\"Vendor\" WHERE \"panNumber\" = ? AND id <> ? ORDER BY \"createdAt\" LIMIT 5",
                String.class, pan, v.vendorId());
        out.add(samePan.isEmpty() ? pass("DUPLICATE_PAN", "No other vendor uses this PAN")
                : warn("DUPLICATE_PAN", "PAN also used by vendor " + String.join(", ", samePan)));

        if (v.bank() != null) {
            List<String> sameBank = jdbc.queryForList("""
                    SELECT v."vendorCode" FROM marketplace.vendor_bank_account b JOIN public."Vendor" v ON v.id = b.vendor_id
                    WHERE b.ifsc = ? AND b.account_last4 = ? AND b.vendor_id <> ? LIMIT 5
                    """, String.class, v.bank().ifsc(), v.bank().last4(), v.vendorId());
            out.add(sameBank.isEmpty() ? pass("DUPLICATE_BANK_ACCOUNT", "Bank account not seen on another vendor")
                    : warn("DUPLICATE_BANK_ACCOUNT", "Same IFSC and last 4 digits as vendor " + String.join(", ", sameBank) + " (possible duplicate)"));
            out.add(holderMatches(v.bank().accountHolder(), v.business().businessName(), v.fullName())
                    ? pass("ACCOUNT_HOLDER_NAME", "Account holder matches the business or owner name")
                    : warn("ACCOUNT_HOLDER_NAME", "Account holder \"" + v.bank().accountHolder() + "\" does not match the business or owner name"));
        }

        List<String> blocked = jdbc.queryForList("""
                SELECT "vendorCode" || ' (' || status::text || ')' FROM public."Vendor"
                WHERE id <> ? AND status IN ('BLACKLISTED', 'REJECTED')
                  AND ("panNumber" = ? OR ("gstNumber" IS NOT NULL AND "gstNumber" = ?) OR phone = ? OR lower(email) = lower(?))
                LIMIT 5
                """, String.class, v.vendorId(), pan, gstin == null ? "" : gstin, v.mobile() == null ? "" : v.mobile(), v.email());
        out.add(blocked.isEmpty() ? pass("BLOCKED_MATCH", "No match with a blocked or rejected vendor")
                : warn("BLOCKED_MATCH", "Shares PAN, GSTIN, mobile or email with " + String.join(", ", blocked)));

        List<String> dealer = jdbc.queryForList("""
                SELECT "companyName" FROM public."Dealer" WHERE "panNumber" = ? OR ("gstNumber" IS NOT NULL AND "gstNumber" = ?) LIMIT 3
                """, String.class, pan, gstin == null ? "" : gstin);
        if (!dealer.isEmpty()) out.add(warn("DEALER_MATCH", "Same PAN/GSTIN as dealer " + String.join(", ", dealer)));
        return out;
    }

    /** Loose match: one name contains the other after dropping punctuation and common suffixes. */
    static boolean holderMatches(String holder, String business, String owner) {
        String h = norm(holder);
        if (h.isEmpty()) return false;
        for (String other : new String[]{business, owner}) {
            String o = norm(other);
            if (!o.isEmpty() && (h.contains(o) || o.contains(h))) return true;
        }
        return false;
    }

    private static String norm(String s) {
        if (s == null) return "";
        return s.toLowerCase(Locale.ROOT)
                .replaceAll("\\b(m/s|ms|pvt|private|ltd|limited|llp|co|company|enterprises|traders|the|and)\\b", " ")
                .replaceAll("[^a-z0-9]", "");
    }

    private static Check pass(String c, String m) { return new Check(c, Result.PASS, m); }
    private static Check warn(String c, String m) { return new Check(c, Result.WARN, m); }
    private static Check fail(String c, String m) { return new Check(c, Result.FAIL, m); }
}
