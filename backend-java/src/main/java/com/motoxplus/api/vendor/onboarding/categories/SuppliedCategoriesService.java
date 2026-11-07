package com.motoxplus.api.vendor.onboarding.categories;

import com.motoxplus.api.catalog.PartCategoryValidator;
import com.motoxplus.api.common.Time;
import com.motoxplus.api.marketplace.audit.AuditLogService;
import com.motoxplus.api.security.AuthenticatedUser;
import com.motoxplus.api.vendor.VendorContext;
import com.motoxplus.api.vendor.VendorSnapshot;
import com.motoxplus.api.web.FieldErrorsException;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Onboarding step: which automotive parts the vendor manufactures or supplies, and for which vehicle segments.
 * Category ids are checked against the LIVE admin-managed tree by the shared PartCategoryValidator and stored as
 * structured links (public."VendorPartCategory"), never as text.
 */
@Service
@ConditionalOnProperty(name = "marketplace.enabled", havingValue = "true")
public class SuppliedCategoriesService {
    /** public."VehicleSegment", same order as src/lib/catalog/vehicle-segments.ts. */
    public static final List<String> SEGMENTS = List.of("MOTORCYCLE", "SCOOTER", "THREE_WHEELER", "PASSENGER_CAR", "COMMERCIAL_VEHICLE", "OTHER");

    public record Request(List<String> categoryIds, List<String> vehicleSegments) {}

    private final JdbcTemplate jdbc;
    private final VendorContext vendors;
    private final PartCategoryValidator validator;
    private final AuditLogService audit;

    public SuppliedCategoriesService(JdbcTemplate jdbc, VendorContext vendors, PartCategoryValidator validator, AuditLogService audit) {
        this.jdbc = jdbc;
        this.vendors = vendors;
        this.validator = validator;
        this.audit = audit;
    }

    @Transactional
    public void save(AuthenticatedUser user, Request in, String ip) {
        VendorSnapshot v = vendors.editable(user);

        List<String> segments = new ArrayList<>(new LinkedHashSet<>(in.vehicleSegments() == null ? List.of() : in.vehicleSegments()));
        if (segments.isEmpty() || !SEGMENTS.containsAll(segments)) {
            throw FieldErrorsException.invalid("vehicleSegments", "Select at least one vehicle segment");
        }
        List<String> ids = in.categoryIds() == null ? List.of() : in.categoryIds();
        if (ids.stream().anyMatch(id -> id == null || id.isBlank() || id.length() > 64)) {
            throw FieldErrorsException.invalid("categoryIds", "Select at least one automotive parts category");
        }
        PartCategoryValidator.Result result = validator.validate(ids);
        if (result instanceof PartCategoryValidator.Invalid bad) throw FieldErrorsException.invalid("categoryIds", bad.error());
        List<String> normalised = ((PartCategoryValidator.Valid) result).ids();

        Timestamp now = Timestamp.valueOf(Time.utcNow());
        jdbc.update("DELETE FROM public.\"VendorPartCategory\" WHERE \"vendorId\" = ?", v.vendorId());
        for (String id : normalised) {
            jdbc.update("INSERT INTO public.\"VendorPartCategory\" (\"vendorId\", \"categoryId\", \"createdAt\") VALUES (?, ?, ?)",
                    v.vendorId(), id, now);
        }
        // Values are whitelisted above, so the array literal cannot carry anything else.
        jdbc.update("UPDATE public.\"Vendor\" SET \"vehicleSegments\" = ?::\"VehicleSegment\"[], \"updatedAt\" = ? WHERE id = ?",
                "{" + String.join(",", segments) + "}", now, v.vendorId());
        jdbc.update("""
                INSERT INTO marketplace.vendor_application (vendor_id, categories_saved_at, updated_at) VALUES (?, now(), now())
                ON CONFLICT (vendor_id) DO UPDATE SET categories_saved_at = now(), updated_at = now()
                """, v.vendorId());
        audit.record(user, "vendor.application.categories_saved", "vendor", v.vendorId(), v.vendorId(), ip,
                Map.of("categoryCount", normalised.size(), "vehicleSegments", segments));
    }
}
