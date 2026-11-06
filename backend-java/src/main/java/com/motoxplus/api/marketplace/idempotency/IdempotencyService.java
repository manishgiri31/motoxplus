package com.motoxplus.api.marketplace.idempotency;

import com.motoxplus.api.web.ApiException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.util.HexFormat;
import java.util.List;
import java.util.function.Supplier;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Exactly-once execution for checkout / payment / shipping-style operations keyed by a client-supplied
 * {@code Idempotency-Key} (or a provider event id for webhooks).
 *
 * <ol>
 *   <li>The key is <b>claimed</b> in its own committed transaction (so a concurrent duplicate sees it at once).
 *       The claim is a short lease, so a crashed process cannot block a key forever.</li>
 *   <li>The action runs. On success the response is stored and the key is retained for {@code retention}.</li>
 *   <li>On failure the claim is released so the client can retry; the exception propagates.</li>
 * </ol>
 * A replay with the same key and the same request returns the stored response without re-running the action.
 * The same key with a different request is rejected (422); a duplicate while the first is still running is 409.
 */
@org.springframework.boot.autoconfigure.condition.ConditionalOnProperty(name = "marketplace.enabled", havingValue = "true")
@Service
public class IdempotencyService {
    public record StoredResponse(int status, String body) {}

    static final Duration IN_PROGRESS_LEASE = Duration.ofMinutes(5);

    private final JdbcTemplate jdbc;
    private final TransactionTemplate newTx;

    public IdempotencyService(JdbcTemplate jdbc, PlatformTransactionManager tm) {
        this.jdbc = jdbc;
        this.newTx = new TransactionTemplate(tm);
        this.newTx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    public StoredResponse execute(String scope, String key, String requestHash, Duration retention,
                                  Supplier<StoredResponse> action) {
        if (key == null || key.length() < 8 || key.length() > 200) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Idempotency-Key must be 8-200 characters", "IDEMPOTENCY_KEY_INVALID", null);
        }
        if (!claim(scope, key, requestHash)) {
            return replayOrReject(scope, key, requestHash);
        }
        StoredResponse result;
        try {
            result = action.get();
        } catch (RuntimeException | Error e) {
            release(scope, key);
            throw e;
        }
        complete(scope, key, result, retention);
        return result;
    }

    /** Inserts the claim, or takes over a row whose lease/retention has expired. */
    private boolean claim(String scope, String key, String requestHash) {
        Integer n = newTx.execute(s -> jdbc.update("""
                INSERT INTO marketplace.idempotency_key (scope, idem_key, request_hash, status, expires_at)
                VALUES (?, ?, ?, 'IN_PROGRESS', now() + (? * interval '1 second'))
                ON CONFLICT (scope, idem_key) DO UPDATE
                   SET request_hash = EXCLUDED.request_hash, status = 'IN_PROGRESS', response_status = NULL,
                       response_body = NULL, created_at = now(), completed_at = NULL, expires_at = EXCLUDED.expires_at
                 WHERE marketplace.idempotency_key.expires_at < now()
                """, scope, key, requestHash, IN_PROGRESS_LEASE.toSeconds()));
        return n != null && n == 1;
    }

    private StoredResponse replayOrReject(String scope, String key, String requestHash) {
        List<Object[]> rows = jdbc.query("""
                SELECT request_hash, status, response_status, response_body
                  FROM marketplace.idempotency_key WHERE scope = ? AND idem_key = ?
                """, (rs, i) -> new Object[]{rs.getString(1), rs.getString(2), rs.getObject(3), rs.getString(4)}, scope, key);
        if (rows.isEmpty()) {
            // Released between our failed claim and this read: tell the client to simply retry.
            throw new ApiException(HttpStatus.CONFLICT, "Request is being processed, retry shortly", "IDEMPOTENCY_IN_PROGRESS", 1L);
        }
        Object[] r = rows.get(0);
        if (!requestHash.equals(r[0])) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY,
                    "Idempotency-Key was already used with a different request", "IDEMPOTENCY_KEY_REUSED", null);
        }
        if ("COMPLETED".equals(r[1])) {
            return new StoredResponse(((Number) r[2]).intValue(), (String) r[3]);
        }
        throw new ApiException(HttpStatus.CONFLICT, "Request is being processed, retry shortly", "IDEMPOTENCY_IN_PROGRESS", 2L);
    }

    private void complete(String scope, String key, StoredResponse r, Duration retention) {
        newTx.executeWithoutResult(s -> jdbc.update("""
                UPDATE marketplace.idempotency_key
                   SET status = 'COMPLETED', response_status = ?, response_body = ?, completed_at = now(),
                       expires_at = now() + (? * interval '1 second')
                 WHERE scope = ? AND idem_key = ?
                """, r.status(), r.body(), retention.toSeconds(), scope, key));
    }

    private void release(String scope, String key) {
        newTx.executeWithoutResult(s -> jdbc.update(
                "DELETE FROM marketplace.idempotency_key WHERE scope = ? AND idem_key = ? AND status = 'IN_PROGRESS'", scope, key));
    }

    /** Stable fingerprint of the request body/params for the same-key-different-request check. */
    public static String hash(String canonicalRequest) {
        try {
            byte[] d = MessageDigest.getInstance("SHA-256").digest(canonicalRequest.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(d);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
