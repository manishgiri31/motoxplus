package com.motoxplus.api.web;

import jakarta.servlet.http.HttpServletRequest;

/**
 * Resolves the real visitor IP behind Cloudflare + Nginx.
 *
 * The Node app takes the FIRST X-Forwarded-For entry, which is whatever the
 * client chose to send (Nginx's $proxy_add_x_forwarded_for only appends), so any
 * visitor could mint a fresh rate-limit identity per request. Here we prefer
 * X-Real-IP — Nginx overwrites it with $remote_addr (already the real visitor via
 * the Cloudflare realip config) — and otherwise take the LAST X-Forwarded-For
 * hop, the one our own proxy appended.
 *
 * This is only safe if the Java port is reachable solely through Nginx: bind it
 * to 127.0.0.1 or firewall it, or a direct caller can still forge X-Real-IP.
 */
public final class ClientIp {
    /** Returned when no proxy header is present; callers must skip per-IP limits for it. */
    public static final String UNKNOWN = "unknown";

    private ClientIp() {}

    public static String resolve(HttpServletRequest req) {
        String realIp = trimToNull(req.getHeader("X-Real-IP"));
        if (realIp != null) return realIp;

        String xff = trimToNull(req.getHeader("X-Forwarded-For"));
        if (xff != null) {
            String[] hops = xff.split(",");
            String last = trimToNull(hops[hops.length - 1]);
            if (last != null) return last;
        }
        return UNKNOWN;
    }

    public static String deviceInfo(HttpServletRequest req) {
        String ua = req.getHeader("User-Agent");
        if (ua == null) return "unknown";
        if (ua.contains("Mobile")) return "Mobile";
        if (ua.contains("Tablet")) return "Tablet";
        return "Desktop";
    }

    private static String trimToNull(String s) {
        if (s == null) return null;
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }
}
