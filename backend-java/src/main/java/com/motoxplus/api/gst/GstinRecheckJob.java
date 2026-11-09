package com.motoxplus.api.gst;

import com.motoxplus.api.common.Time;
import java.sql.Timestamp;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Re-checks dealer GSTINs still PENDING: ones saved while the registry could not be reached at sign-up, and
 * pre-existing unconfirmed GSTINs queued by Flyway V5. Backs off 30 min x attempts, gives up after
 * {@code MAX_ATTEMPTS} (staff can still confirm by hand from the admin dealer page).
 */
@Component
public class GstinRecheckJob {
    private static final Logger log = LoggerFactory.getLogger(GstinRecheckJob.class);
    static final int MAX_ATTEMPTS = 8;
    private static final int BATCH = 20;

    private final GstinVerificationService service;
    private final JdbcTemplate jdbc;
    private final boolean enabled;

    public GstinRecheckJob(GstinVerificationService service, JdbcTemplate jdbc,
                           @Value("${app.gst.recheck.enabled:true}") boolean enabled) {
        this.service = service;
        this.jdbc = jdbc;
        this.enabled = enabled;
    }

    @Scheduled(initialDelayString = "${app.gst.recheck.initial-delay-ms:60000}",
               fixedDelayString = "${app.gst.recheck.interval-ms:600000}")
    public void run() {
        if (!enabled || !service.isLiveCheckAvailable()) return;
        try {
            int done = recheckBatch();
            if (done > 0) log.info("[GSTIN] re-checked {} pending dealer GSTIN(s)", done);
        } catch (RuntimeException e) {
            // A scheduler thread must never die on a DB hiccup (or on a database Flyway V5 has not reached yet).
            log.warn("[GSTIN] re-check skipped: {}", e.getClass().getSimpleName());
        }
    }

    int recheckBatch() {
        Timestamp now = Timestamp.valueOf(Time.utcNow());
        List<Map<String, Object>> due = jdbc.queryForList("""
                SELECT id, "gstNumber" FROM public."Dealer"
                 WHERE "gstVerificationStatus" = 'PENDING' AND "gstNumber" IS NOT NULL AND "gstCheckAttempts" < ?
                   AND ("gstLastCheckedAt" IS NULL OR "gstLastCheckedAt" < CAST(? AS timestamp(3)) - make_interval(mins => 30 * "gstCheckAttempts"))
                 ORDER BY "gstLastCheckedAt" NULLS FIRST
                 LIMIT ?
                """, MAX_ATTEMPTS, now, BATCH);
        int done = 0;
        for (Map<String, Object> row : due) {
            var v = service.verify((String) row.get("gstNumber"));
            if (service.recordPendingResult((String) row.get("id"), v)) done++;
        }
        return done;
    }
}
