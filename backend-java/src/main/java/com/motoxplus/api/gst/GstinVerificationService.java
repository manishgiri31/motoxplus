package com.motoxplus.api.gst;

import com.motoxplus.api.common.Time;
import java.sql.Timestamp;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/**
 * Verifies a GSTIN against the GST registry and records the result on a dealer.
 *
 * A well-formed GSTIN is never treated as valid on its own: only {@link Status#VERIFIED} (registry says
 * registered + Active) sets {@code Dealer.gstVerified}, which is what lets the GSTIN appear on a tax invoice.
 */
@Service
public class GstinVerificationService {

    /** Same names as the DB enum "GstinVerificationStatus". */
    public enum Status {
        VERIFIED,
        /** Malformed, or not on the register. */
        INVALID,
        /** On the register but cancelled / suspended. */
        INACTIVE,
        /** Could not be checked right now; GstinRecheckJob retries. */
        PENDING
    }

    public static final String SOURCE_API = "GST_API";

    public record Verification(String gstin, Status status, String legalName, String tradeName,
                               String registrationStatus, String principalAddress) {}

    private final GstinLookup lookup;
    private final JdbcTemplate jdbc;

    public GstinVerificationService(GstinLookup lookup, JdbcTemplate jdbc) {
        this.lookup = lookup;
        this.jdbc = jdbc;
    }

    public boolean isLiveCheckAvailable() {
        return lookup.isConfigured();
    }

    public Verification verify(String raw) {
        String gstin = Gstin.normalize(raw);
        if (!Gstin.isWellFormed(gstin)) return new Verification(gstin, Status.INVALID, null, null, null, null);
        GstinLookup.Result r = lookup.lookup(gstin);
        Status status = switch (r.outcome()) {
            case ACTIVE -> Status.VERIFIED;
            case INACTIVE -> Status.INACTIVE;
            case NOT_FOUND -> Status.INVALID;
            case UNAVAILABLE -> Status.PENDING;
        };
        return new Verification(gstin, status, r.legalName(), r.tradeName(), r.registrationStatus(), r.principalAddress());
    }

    /**
     * Writes a re-check result onto a dealer still waiting for one. Guarded so it never overrides a decision
     * staff made meanwhile, or a GSTIN the dealer has since changed.
     *
     * @return true if the dealer row was updated
     */
    public boolean recordPendingResult(String dealerId, Verification v) {
        Timestamp now = Timestamp.valueOf(Time.utcNow());
        if (v.status() == Status.PENDING) {
            return jdbc.update("""
                    UPDATE public."Dealer" SET "gstCheckAttempts" = "gstCheckAttempts" + 1, "gstLastCheckedAt" = ?
                     WHERE id = ? AND "gstNumber" = ? AND "gstVerificationStatus" = 'PENDING'
                    """, now, dealerId, v.gstin()) == 1;
        }
        boolean verified = v.status() == Status.VERIFIED;
        return jdbc.update("""
                UPDATE public."Dealer"
                   SET "gstVerificationStatus" = ?::"GstinVerificationStatus", "gstVerificationSource" = ?,
                       "gstVerified" = ?, "gstVerifiedAt" = ?,
                       "gstLegalName" = ?, "gstTradeName" = ?, "gstRegistrationStatus" = ?, "gstPrincipalAddress" = ?,
                       "gstCheckAttempts" = "gstCheckAttempts" + 1, "gstLastCheckedAt" = ?, "updatedAt" = ?
                 WHERE id = ? AND "gstNumber" = ? AND "gstVerificationStatus" = 'PENDING'
                """, v.status().name(), SOURCE_API, verified, verified ? now : null,
                v.legalName(), v.tradeName(), v.registrationStatus(), v.principalAddress(), now, now,
                dealerId, v.gstin()) == 1;
    }
}
