package com.motoxplus.api.common;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;

/**
 * Prisma stores DateTime as {@code timestamp(3) without time zone}, always in
 * UTC. Entities therefore use LocalDateTime and every "now" must be UTC -
 * never the server's local clock - or session expiry/lockout times would shift.
 */
public final class Time {
    /** Same shape as JavaScript's Date.toISOString(), which the web client already parses. */
    private static final DateTimeFormatter ISO_MILLIS_Z = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");

    private Time() {}

    public static LocalDateTime utcNow() {
        return LocalDateTime.now(ZoneOffset.UTC);
    }

    /** Null-safe: returns null for null so DTO fields stay null in JSON. */
    public static String iso(LocalDateTime utc) {
        return utc == null ? null : ISO_MILLIS_Z.format(utc);
    }
}
