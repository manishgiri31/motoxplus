package com.motoxplus.api.auth.otp;

import com.motoxplus.api.common.Cuid;
import com.motoxplus.api.common.Time;
import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.List;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * One-time codes in the shared "OtpCode" table, a line-by-line port of src/lib/auth/otp.ts.
 *
 * Interoperable with Node on purpose: same HMAC-SHA256 of "otp:{userId}:{type}:{code}" keyed with JWT_SECRET,
 * same 6 digits, 5-minute expiry, 5 attempts, 15-minute cooldown after a maxed-out code, 10 sends per hour.
 * A code issued by either server verifies on the other, so endpoints can move to Java one at a time.
 */
@Service
public class OtpService {
    public enum OtpType { EMAIL_VERIFICATION, MOBILE_VERIFICATION, LOGIN, FORGOT_PASSWORD }

    public record VerifyResult(boolean success, String error) {
        static VerifyResult ok() { return new VerifyResult(true, null); }
        static VerifyResult fail(String error) { return new VerifyResult(false, error); }
    }

    public static final int OTP_LENGTH = 6;
    public static final int EXPIRY_MINUTES = 5;
    public static final int MAX_ATTEMPTS = 5;
    public static final int MAX_SENDS_PER_HOUR = 10;
    public static final int LOCKOUT_COOLDOWN_MINUTES = 15;

    private static final SecureRandom RANDOM = new SecureRandom();

    private final JdbcTemplate jdbc;
    private final byte[] secret;

    public OtpService(JdbcTemplate jdbc, @Value("${app.jwt.secret:}") String secret) {
        if (secret == null || secret.isBlank()) {
            throw new IllegalStateException("JWT_SECRET must be set: refusing to hash OTPs with no secret");
        }
        this.jdbc = jdbc;
        this.secret = secret.getBytes(StandardCharsets.UTF_8);
    }

    static String generateCode() {
        return String.format("%0" + OTP_LENGTH + "d", RANDOM.nextInt((int) Math.pow(10, OTP_LENGTH)));
    }

    String hash(String userId, OtpType type, String code) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret, "HmacSHA256"));
            byte[] out = mac.doFinal(("otp:" + userId + ":" + type.name() + ":" + code).getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(out);
        } catch (NoSuchAlgorithmException | InvalidKeyException e) {
            throw new IllegalStateException(e);
        }
    }

    /** Burns any unused codes of this type, stores a new hashed one, and returns the plaintext for delivery only. */
    @Transactional
    public String create(String userId, OtpType type) {
        jdbc.update("UPDATE \"OtpCode\" SET \"used\" = true WHERE \"userId\" = ? AND \"type\" = ?::\"OtpType\" AND \"used\" = false",
                userId, type.name());
        String code = generateCode();
        LocalDateTime now = Time.utcNow();
        jdbc.update("""
                INSERT INTO "OtpCode" ("id", "userId", "type", "code", "expiresAt", "used", "attempts", "createdAt")
                VALUES (?, ?, ?::"OtpType", ?, ?, false, 0, ?)
                """, Cuid.next(), userId, type.name(), hash(userId, type, code),
                Timestamp.valueOf(now.plusMinutes(EXPIRY_MINUTES)), Timestamp.valueOf(now));
        return code;
    }

    private record Row(String id, String code, LocalDateTime expiresAt, int attempts) {}

    public VerifyResult verify(String userId, OtpType type, String provided) {
        List<Row> rows = jdbc.query("""
                SELECT "id", "code", "expiresAt", "attempts" FROM "OtpCode"
                WHERE "userId" = ? AND "type" = ?::"OtpType" AND "used" = false
                ORDER BY "createdAt" DESC LIMIT 1
                """, (rs, i) -> new Row(rs.getString(1), rs.getString(2), rs.getTimestamp(3).toLocalDateTime(), rs.getInt(4)),
                userId, type.name());
        if (rows.isEmpty()) return VerifyResult.fail("Invalid or expired OTP");
        Row otp = rows.get(0);

        if (otp.expiresAt().isBefore(Time.utcNow())) {
            burn(otp.id());
            return VerifyResult.fail("OTP has expired");
        }
        if (otp.attempts() >= MAX_ATTEMPTS) {
            burn(otp.id());
            return VerifyResult.fail("Too many incorrect attempts");
        }

        if (!matches(otp.code(), userId, type, provided)) {
            Integer attempts = jdbc.queryForObject(
                    "UPDATE \"OtpCode\" SET \"attempts\" = \"attempts\" + 1 WHERE \"id\" = ? RETURNING \"attempts\"",
                    Integer.class, otp.id());
            int remaining = Math.max(0, MAX_ATTEMPTS - (attempts == null ? MAX_ATTEMPTS : attempts));
            return VerifyResult.fail(remaining > 0 ? "Incorrect OTP. " + remaining + " attempt(s) remaining" : "Too many incorrect attempts");
        }

        // Only the call that flips used=false -> true succeeds; a concurrent double-submit gets 0 rows and fails closed.
        int claimed = jdbc.update("UPDATE \"OtpCode\" SET \"used\" = true WHERE \"id\" = ? AND \"used\" = false", otp.id());
        return claimed == 1 ? VerifyResult.ok() : VerifyResult.fail("Invalid or expired OTP");
    }

    /** False while locked out after a maxed-out code, or when this hour's send budget is used up. */
    public boolean canSend(String userId, OtpType type) {
        return canSend(userId, type, MAX_SENDS_PER_HOUR);
    }

    public boolean canSend(String userId, OtpType type, int maxPerHour) {
        LocalDateTime now = Time.utcNow();
        List<Timestamp> maxed = jdbc.queryForList("""
                SELECT "createdAt" FROM "OtpCode"
                WHERE "userId" = ? AND "type" = ?::"OtpType" AND "attempts" >= ?
                ORDER BY "createdAt" DESC LIMIT 1
                """, Timestamp.class, userId, type.name(), MAX_ATTEMPTS);
        if (!maxed.isEmpty() && maxed.get(0).toLocalDateTime().plusMinutes(LOCKOUT_COOLDOWN_MINUTES).isAfter(now)) {
            return false;
        }
        Integer sent = jdbc.queryForObject("""
                SELECT count(*) FROM "OtpCode" WHERE "userId" = ? AND "type" = ?::"OtpType" AND "createdAt" >= ?
                """, Integer.class, userId, type.name(), Timestamp.valueOf(now.minusHours(1)));
        return sent == null || sent < maxPerHour;
    }

    private void burn(String id) {
        jdbc.update("UPDATE \"OtpCode\" SET \"used\" = true WHERE \"id\" = ? AND \"used\" = false", id);
    }

    private boolean matches(String stored, String userId, OtpType type, String provided) {
        if (provided == null) return false;
        byte[] a = stored.getBytes(StandardCharsets.UTF_8);
        byte[] b = hash(userId, type, provided).getBytes(StandardCharsets.UTF_8);
        // Different lengths = a legacy plaintext row from before hashing; never equal.
        return a.length == b.length && MessageDigest.isEqual(a, b);
    }
}
