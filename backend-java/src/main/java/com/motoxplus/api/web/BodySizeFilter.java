package com.motoxplus.api.web;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.regex.Pattern;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Rejects oversized bodies on Content-Length before anything is buffered or parsed
 * (port of rejectOversizedBody). Nginx caps bodies at 20MB for image uploads, far too
 * loose for a JSON endpoint, so everything except /api/upload/** is held to 16KB,
 * apart from the marketplace's multipart file uploads (5MB files), which get {@link #UPLOAD_MAX_BYTES}.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class BodySizeFilter extends OncePerRequestFilter {
    static final long JSON_BODY_MAX_BYTES = 16 * 1024;
    /** One 5MB file plus multipart framing. The endpoints themselves enforce the 5MB file limit. */
    static final long UPLOAD_MAX_BYTES = 6L * 1024 * 1024;
    /** KYC documents (Phase 2) and listing photos (Phase 4). Browsers send Content-Length, so 16KB would refuse them. */
    private static final Pattern UPLOAD_PATHS =
            Pattern.compile("^/api/v1/vendors/me/(application/documents|listings/[^/]+/images)$");

    @Override
    protected boolean shouldNotFilter(HttpServletRequest req) {
        return req.getRequestURI().startsWith("/api/upload");
    }

    static long limitFor(HttpServletRequest req) {
        return "POST".equals(req.getMethod()) && UPLOAD_PATHS.matcher(req.getRequestURI()).matches() ? UPLOAD_MAX_BYTES : JSON_BODY_MAX_BYTES;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        if (req.getContentLengthLong() > limitFor(req)) {
            res.setStatus(413);
            res.setContentType("application/json");
            res.getWriter().write("{\"error\":\"Request body too large.\",\"code\":\"PAYLOAD_TOO_LARGE\"}");
            return;
        }
        chain.doFilter(req, res);
    }
}
