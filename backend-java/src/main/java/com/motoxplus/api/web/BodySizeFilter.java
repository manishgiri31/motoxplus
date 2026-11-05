package com.motoxplus.api.web;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Rejects oversized bodies on Content-Length before anything is buffered or parsed
 * (port of rejectOversizedBody). Nginx caps bodies at 20MB for image uploads, far too
 * loose for a JSON endpoint, so everything except /api/upload/** is held to 16KB.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class BodySizeFilter extends OncePerRequestFilter {
    static final long JSON_BODY_MAX_BYTES = 16 * 1024;

    @Override
    protected boolean shouldNotFilter(HttpServletRequest req) {
        return req.getRequestURI().startsWith("/api/upload");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        if (req.getContentLengthLong() > JSON_BODY_MAX_BYTES) {
            res.setStatus(413);
            res.setContentType("application/json");
            res.getWriter().write("{\"error\":\"Request body too large.\",\"code\":\"PAYLOAD_TOO_LARGE\"}");
            return;
        }
        chain.doFilter(req, res);
    }
}
