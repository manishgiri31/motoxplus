package com.motoxplus.api.web;

import org.springframework.http.HttpStatus;

/**
 * A failure that maps straight to the JSON error shape the Next.js API uses:
 * {@code {"error": "...", "code": "...", "retryAfterSeconds": 30}}. The web
 * client already parses that shape, so the Java API keeps it byte-compatible.
 */
public class ApiException extends RuntimeException {
    private final HttpStatus status;
    private final String code;
    private final Long retryAfterSeconds;

    public ApiException(HttpStatus status, String message) {
        this(status, message, null, null);
    }

    public ApiException(HttpStatus status, String message, String code, Long retryAfterSeconds) {
        super(message);
        this.status = status;
        this.code = code;
        this.retryAfterSeconds = retryAfterSeconds;
    }

    public HttpStatus status() { return status; }
    public String code() { return code; }
    public Long retryAfterSeconds() { return retryAfterSeconds; }

    public static ApiException unauthorized() {
        return new ApiException(HttpStatus.UNAUTHORIZED, "Unauthorized");
    }

    public static ApiException rateLimited(long retryAfterSeconds) {
        long seconds = Math.max(1, retryAfterSeconds);
        return new ApiException(HttpStatus.TOO_MANY_REQUESTS,
                "Too many requests. Please try again in " + formatRetryAfter(seconds) + ".",
                "RATE_LIMITED", seconds);
    }

    static String formatRetryAfter(long seconds) {
        if (seconds < 90) return seconds + " seconds";
        long minutes = (long) Math.ceil(seconds / 60.0);
        return minutes <= 1 ? "a minute" : minutes + " minutes";
    }
}
