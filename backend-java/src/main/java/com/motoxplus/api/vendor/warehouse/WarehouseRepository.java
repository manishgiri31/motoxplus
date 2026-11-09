package com.motoxplus.api.vendor.warehouse;

import com.motoxplus.api.common.Cuid;
import com.motoxplus.api.common.Time;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * public."DelhiveryWarehouse". Timestamps are UTC wall-clock (timestamp(3), as Prisma stores them), always written from
 * {@link Time#utcNow()} rather than the database's session-zone now().
 */
@Repository
@ConditionalOnProperty(name = "marketplace.enabled", havingValue = "true")
public class WarehouseRepository {
    private static final String COLUMNS = """
            id, "ownerType"::text AS owner_type, "vendorId", "delhiveryName", address, pin, city, state, phone, email,
            "returnAddress", "returnPin", "returnCity", "returnState", gstin, status::text AS status, "lastError",
            "lastErrorCode", attempts, "attemptStartedAt", "activatedAt", "createdAt", "updatedAt"
            """;

    private final JdbcTemplate jdbc;

    public WarehouseRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<Warehouse> byVendor(String vendorId) {
        return one("SELECT " + COLUMNS + " FROM public.\"DelhiveryWarehouse\" WHERE \"vendorId\" = ?", vendorId);
    }

    public Optional<Warehouse> byId(String id) {
        return one("SELECT " + COLUMNS + " FROM public.\"DelhiveryWarehouse\" WHERE id = ?", id);
    }

    /** Status of the vendor's warehouse, or null when the vendor has none. */
    public String statusForVendor(String vendorId) {
        List<String> s = jdbc.queryForList("SELECT status::text FROM public.\"DelhiveryWarehouse\" WHERE \"vendorId\" = ?", String.class, vendorId);
        return s.isEmpty() ? null : s.get(0);
    }

    /** Is the name already held by a row other than {@code exceptId}? Checked before any Delhivery call. */
    public boolean nameTaken(String delhiveryName, String exceptId) {
        Integer n = jdbc.queryForObject("""
                SELECT count(*) FROM public."DelhiveryWarehouse" WHERE "delhiveryName" = ? AND (?::text IS NULL OR id <> ?)""",
                Integer.class, delhiveryName, exceptId, exceptId);
        return n != null && n > 0;
    }

    /** New vendor warehouse, already claimed for its first attempt (PENDING, attempt 1 in flight). */
    public String insertPending(String vendorId, String name, Warehouse.Details d, String gstin) {
        String id = Cuid.next();
        Timestamp now = Timestamp.valueOf(Time.utcNow());
        jdbc.update("""
                INSERT INTO public."DelhiveryWarehouse" (id, "ownerType", "vendorId", "delhiveryName", address, pin, city, state, phone, email,
                    "returnAddress", "returnPin", "returnCity", "returnState", gstin, status, attempts, "attemptStartedAt",
                    "createdAt", "updatedAt")
                VALUES (?, 'VENDOR', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', 1, ?, ?, ?)""",
                id, vendorId, name, d.address(), d.pin(), d.city(), d.state(), d.phone(), d.email(), d.returnAddress(),
                d.returnPin(), d.returnCity(), d.returnState(), gstin, now, now, now);
        return id;
    }

    /**
     * Replaces the details of a warehouse Delhivery definitely never created (FAILED, not UNCERTAIN) and claims the
     * next attempt. Returns false when the row changed underneath (someone else claimed it, or it is no longer editable).
     */
    public boolean replaceAndClaim(String id, String name, Warehouse.Details d, String gstin) {
        Timestamp now = Timestamp.valueOf(Time.utcNow());
        return jdbc.update("""
                UPDATE public."DelhiveryWarehouse" SET "delhiveryName" = ?, address = ?, pin = ?, city = ?, state = ?, phone = ?, email = ?,
                    "returnAddress" = ?, "returnPin" = ?, "returnCity" = ?, "returnState" = ?, gstin = ?,
                    status = 'PENDING', attempts = attempts + 1, "attemptStartedAt" = ?, "updatedAt" = ?
                WHERE id = ? AND status = 'FAILED' AND "lastErrorCode" IS DISTINCT FROM 'UNCERTAIN'""",
                name, d.address(), d.pin(), d.city(), d.state(), d.phone(), d.email(), d.returnAddress(), d.returnPin(),
                d.returnCity(), d.returnState(), gstin, now, now, id) == 1;
    }

    /**
     * Claims a retry with the SAME details and name: only one caller can move a FAILED (or abandoned PENDING) row
     * back to PENDING, so two concurrent retries never make two Delhivery calls.
     */
    public boolean claimRetry(String id) {
        LocalDateTime now = Time.utcNow();
        return jdbc.update("""
                UPDATE public."DelhiveryWarehouse" SET status = 'PENDING', attempts = attempts + 1, "attemptStartedAt" = ?, "updatedAt" = ?
                WHERE id = ? AND (status = 'FAILED' OR (status = 'PENDING' AND ("attemptStartedAt" IS NULL OR "attemptStartedAt" < ?)))""",
                Timestamp.valueOf(now), Timestamp.valueOf(now), id,
                Timestamp.valueOf(now.minusSeconds(Warehouse.STALE_ATTEMPT_SECONDS))) == 1;
    }

    public void markActive(String id, String delhiveryName) {
        Timestamp now = Timestamp.valueOf(Time.utcNow());
        jdbc.update("""
                UPDATE public."DelhiveryWarehouse" SET status = 'ACTIVE', "delhiveryName" = ?, "lastError" = NULL, "lastErrorCode" = NULL,
                    "attemptStartedAt" = NULL, "activatedAt" = ?, "updatedAt" = ?
                WHERE id = ? AND status = 'PENDING'""", delhiveryName, now, now, id);
    }

    public void markFailed(String id, String code, String error) {
        Timestamp now = Timestamp.valueOf(Time.utcNow());
        String e = error == null ? null : (error.length() > 1000 ? error.substring(0, 1000) : error);
        jdbc.update("""
                UPDATE public."DelhiveryWarehouse" SET status = 'FAILED', "lastError" = ?, "lastErrorCode" = ?, "attemptStartedAt" = NULL,
                    "updatedAt" = ?
                WHERE id = ? AND status = 'PENDING'""", e, code, now, id);
    }

    private Optional<Warehouse> one(String sql, Object... args) {
        List<Warehouse> rows = jdbc.query(sql, (rs, i) -> map(rs), args);
        return rows.isEmpty() ? Optional.empty() : Optional.of(rows.get(0));
    }

    private static Warehouse map(ResultSet rs) throws SQLException {
        var d = new Warehouse.Details(rs.getString("address"), rs.getString("pin"), rs.getString("city"), rs.getString("state"),
                rs.getString("phone"), rs.getString("email"), rs.getString("returnAddress"), rs.getString("returnPin"),
                rs.getString("returnCity"), rs.getString("returnState"));
        return new Warehouse(rs.getString("id"), rs.getString("owner_type"), rs.getString("vendorId"), rs.getString("delhiveryName"),
                d, rs.getString("gstin"), rs.getString("status"), rs.getString("lastError"), rs.getString("lastErrorCode"),
                rs.getInt("attempts"), local(rs.getTimestamp("attemptStartedAt")), local(rs.getTimestamp("activatedAt")),
                local(rs.getTimestamp("createdAt")), local(rs.getTimestamp("updatedAt")));
    }

    private static LocalDateTime local(Timestamp t) { return t == null ? null : t.toLocalDateTime(); }
}
