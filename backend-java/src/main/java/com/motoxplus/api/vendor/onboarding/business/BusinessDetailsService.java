package com.motoxplus.api.vendor.onboarding.business;

import com.motoxplus.api.common.IndianStates;
import com.motoxplus.api.common.Time;
import com.motoxplus.api.marketplace.audit.AuditLogService;
import com.motoxplus.api.security.AuthenticatedUser;
import com.motoxplus.api.vendor.VendorContext;
import com.motoxplus.api.vendor.VendorSnapshot;
import com.motoxplus.api.web.FieldErrorsException;
import java.sql.Timestamp;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Onboarding step: business identity and address, stored on public."Vendor" (+ business type on the application). */
@Service
@ConditionalOnProperty(name = "marketplace.enabled", havingValue = "true")
public class BusinessDetailsService {
    public static final Pattern PAN = Pattern.compile("^[A-Z]{5}[0-9]{4}[A-Z]$");
    public static final Pattern GSTIN = Pattern.compile("^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$");
    private static final Pattern PINCODE = Pattern.compile("^[1-9][0-9]{5}$");
    public static final Set<String> BUSINESS_TYPES = Set.of("MANUFACTURER", "WHOLESALER", "DISTRIBUTOR", "STOCKIST", "RETAILER", "OTHER");

    public record Request(String businessName, String businessType, String pan, String gstin, String address,
                          String state, String city, String pincode) {}

    private final JdbcTemplate jdbc;
    private final VendorContext vendors;
    private final AuditLogService audit;

    public BusinessDetailsService(JdbcTemplate jdbc, VendorContext vendors, AuditLogService audit) {
        this.jdbc = jdbc;
        this.vendors = vendors;
        this.audit = audit;
    }

    @Transactional
    public void save(AuthenticatedUser user, Request in, String ip) {
        VendorSnapshot v = vendors.editable(user);

        String name = trim(in.businessName());
        String type = trim(in.businessType()).toUpperCase(Locale.ROOT);
        String pan = trim(in.pan()).toUpperCase(Locale.ROOT);
        String gstin = trim(in.gstin()).toUpperCase(Locale.ROOT);
        String address = trim(in.address());
        String state = trim(in.state());
        String city = trim(in.city());
        String pincode = trim(in.pincode());

        Map<String, String> e = new LinkedHashMap<>();
        if (name.length() < 2) e.put("businessName", "Business name is required");
        else if (name.length() > 150) e.put("businessName", "Business name must be at most 150 characters");
        if (!BUSINESS_TYPES.contains(type)) e.put("businessType", "Select your business type");
        if (pan.isEmpty()) e.put("pan", "Business PAN is required");
        else if (!PAN.matcher(pan).matches()) e.put("pan", "PAN looks like ABCDE1234F");
        if (!gstin.isEmpty() && !GSTIN.matcher(gstin).matches()) e.put("gstin", "Enter a valid 15-character GSTIN");
        // Characters 3-12 of a GSTIN are the holder's PAN, so a mismatch is a typo or the wrong PAN.
        else if (!gstin.isEmpty() && PAN.matcher(pan).matches() && !gstin.substring(2, 12).equals(pan)) {
            e.put("gstin", "This GSTIN does not belong to the PAN you entered");
        }
        if (address.length() < 8) e.put("address", "Business address must be at least 8 characters");
        else if (address.length() > 300) e.put("address", "Business address must be at most 300 characters");
        if (!IndianStates.ALL.contains(state)) e.put("state", "Select a state");
        if (city.length() < 2) e.put("city", "City is required");
        else if (city.length() > 80) e.put("city", "City must be at most 80 characters");
        if (!PINCODE.matcher(pincode).matches()) e.put("pincode", "Enter a valid 6-digit pincode");
        if (!e.isEmpty()) throw FieldErrorsException.invalid(e);

        if (!gstin.isEmpty() && !jdbc.queryForList(
                "SELECT 1 FROM public.\"Vendor\" WHERE \"gstNumber\" = ? AND id <> ?", Integer.class, gstin, v.vendorId()).isEmpty()) {
            throw FieldErrorsException.conflict("gstin", "This GSTIN is already registered with another vendor account");
        }

        Timestamp now = Timestamp.valueOf(Time.utcNow());
        try {
            jdbc.update("""
                    UPDATE public."Vendor" SET "companyName" = ?, "panNumber" = ?, "gstNumber" = ?, address = ?, state = ?, city = ?,
                           pincode = ?, "updatedAt" = ?
                    WHERE id = ?
                    """, name, pan, gstin.isEmpty() ? null : gstin, address, state, city, pincode, now, v.vendorId());
        } catch (DuplicateKeyException ex) {
            throw FieldErrorsException.conflict("gstin", "This GSTIN is already registered with another vendor account");
        }
        jdbc.update("""
                INSERT INTO marketplace.vendor_application (vendor_id, business_type, business_saved_at, updated_at)
                VALUES (?, ?, now(), now())
                ON CONFLICT (vendor_id) DO UPDATE SET business_type = EXCLUDED.business_type, business_saved_at = now(), updated_at = now()
                """, v.vendorId(), type);
        audit.record(user, "vendor.application.business_saved", "vendor", v.vendorId(), v.vendorId(), ip,
                Map.of("businessType", type, "gstinProvided", !gstin.isEmpty()));
    }

    private static String trim(String s) { return s == null ? "" : s.trim().replaceAll("\\s+", " "); }
}
