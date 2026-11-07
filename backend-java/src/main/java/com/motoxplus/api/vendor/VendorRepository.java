package com.motoxplus.api.vendor;

import java.sql.Array;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Reads a vendor's account + application as one {@link VendorSnapshot}. Writes live in the feature services. */
@Repository
@ConditionalOnProperty(name = "marketplace.enabled", havingValue = "true")
public class VendorRepository {
    private final JdbcTemplate jdbc;

    public VendorRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<VendorSnapshot> byUserId(String userId) {
        return load("v.\"userId\" = ?", userId);
    }

    public Optional<VendorSnapshot> byVendorId(String vendorId) {
        return load("v.id = ?", vendorId);
    }

    private Optional<VendorSnapshot> load(String where, String param) {
        List<VendorSnapshot> rows = jdbc.query("""
                SELECT v.id, v."userId", v."vendorCode", v.status::text AS status,
                       u.name, u.email, u."mobileNumber", u."emailVerified" IS NOT NULL AS email_verified,
                       u."mobileVerified", u."isActive", v."createdAt",
                       v."companyName", v."panNumber", v."gstNumber", v.address, v.state, v.city, v.pincode,
                       v."vehicleSegments"::text[] AS segments,
                       a.business_type, a.business_saved_at, a.categories_saved_at, a.submitted_at, a.agreement_version,
                       a.decision, a.decision_reason, a.decided_at,
                       b.account_holder, b.bank_name, b.ifsc, b.account_last4
                FROM public."Vendor" v
                JOIN public."User" u ON u.id = v."userId"
                LEFT JOIN marketplace.vendor_application a ON a.vendor_id = v.id
                LEFT JOIN marketplace.vendor_bank_account b ON b.vendor_id = v.id
                WHERE\s""" + where, (rs, i) -> map(rs), param);
        if (rows.isEmpty()) return Optional.empty();
        VendorSnapshot base = rows.get(0);

        List<String> categoryIds = jdbc.queryForList(
                "SELECT \"categoryId\" FROM public.\"VendorPartCategory\" WHERE \"vendorId\" = ? ORDER BY \"createdAt\", \"categoryId\"",
                String.class, base.vendorId());
        List<VendorSnapshot.Document> docs = jdbc.query("""
                SELECT id, "documentType"::text, "fileName", "fileSize", key, "fileUrl", "uploadedAt"
                FROM public."VendorDocument" WHERE "vendorId" = ? ORDER BY "uploadedAt" DESC
                """, (rs, i) -> new VendorSnapshot.Document(rs.getString(1), rs.getString(2), rs.getString(3), rs.getInt(4),
                rs.getString(5), rs.getString(6), local(rs.getTimestamp(7))), base.vendorId());

        return Optional.of(new VendorSnapshot(base.vendorId(), base.userId(), base.vendorCode(), base.status(), base.fullName(),
                base.email(), base.mobile(), base.emailVerified(), base.mobileVerified(), base.userActive(), base.createdAt(),
                base.business(), categoryIds, base.vehicleSegments(), base.bank(), docs, base.application()));
    }

    private static VendorSnapshot map(ResultSet rs) throws SQLException {
        var business = new VendorSnapshot.Business(nz(rs.getString("companyName")), rs.getString("business_type"),
                rs.getString("panNumber"), rs.getString("gstNumber"), rs.getString("address"),
                rs.getString("state"), rs.getString("city"), rs.getString("pincode"));
        String holder = rs.getString("account_holder");
        var bank = holder == null ? null : new VendorSnapshot.Bank(holder, rs.getString("bank_name"), rs.getString("ifsc"),
                rs.getString("account_last4"));
        var app = new VendorSnapshot.Application(odt(rs, "business_saved_at"), odt(rs, "categories_saved_at"),
                odt(rs, "submitted_at"), rs.getString("agreement_version"), rs.getString("decision"),
                rs.getString("decision_reason"), odt(rs, "decided_at"));
        return new VendorSnapshot(rs.getString("id"), rs.getString("userId"), rs.getString("vendorCode"), rs.getString("status"),
                rs.getString("name"), rs.getString("email"), rs.getString("mobileNumber"), rs.getBoolean("email_verified"),
                rs.getBoolean("mobileVerified"), rs.getBoolean("isActive"), local(rs.getTimestamp("createdAt")),
                business, List.of(), array(rs.getArray("segments")), bank, List.of(), app);
    }

    private static List<String> array(Array a) throws SQLException {
        return a == null ? List.of() : Arrays.asList((String[]) a.getArray());
    }

    private static OffsetDateTime odt(ResultSet rs, String col) throws SQLException {
        return rs.getObject(col, OffsetDateTime.class);
    }

    private static LocalDateTime local(Timestamp t) { return t == null ? null : t.toLocalDateTime(); }

    private static String nz(String s) { return s == null ? "" : s; }
}
