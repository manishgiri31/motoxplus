package com.motoxplus.api.security;

import com.motoxplus.api.auth.SessionService;
import com.motoxplus.api.common.Time;
import com.motoxplus.api.security.JwtService.AccessClaims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import java.util.Optional;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Authenticates a request from the mx_access cookie or a Bearer header (port of
 * extractAccessToken/getAuthUser in src/lib/auth/middleware.ts). A valid JWT alone
 * is not enough: the backing UserSession row must still be active, because disable,
 * logout-all and password reset revoke sessions while the 15-minute access token
 * stays cryptographically valid. Not a @Component on purpose - SecurityConfig
 * builds it, so Boot doesn't also register it as a plain servlet filter.
 */
public class JwtAuthFilter extends OncePerRequestFilter {
    private final JwtService jwt;
    private final SessionService sessions;

    public JwtAuthFilter(JwtService jwt, SessionService sessions) {
        this.jwt = jwt;
        this.sessions = sessions;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        String token = extractAccessToken(req);
        if (token != null) {
            authenticate(token);
        }
        chain.doFilter(req, res);
    }

    private void authenticate(String token) {
        Optional<AccessClaims> claims = jwt.verifyAccessToken(token);
        if (claims.isEmpty() || claims.get().sessionId() == null) return;

        boolean sessionOk = sessions.findSession(claims.get().sessionId())
                .filter(s -> s.isActive() && s.getExpiresAt().isAfter(Time.utcNow()))
                .filter(s -> s.getUserId().equals(claims.get().userId()))
                .isPresent();
        if (!sessionOk) return;

        AccessClaims c = claims.get();
        AuthenticatedUser principal = new AuthenticatedUser(c.userId(), c.email(), c.role(), c.sessionId());
        var auth = new UsernamePasswordAuthenticationToken(
                principal, null, List.of(new SimpleGrantedAuthority("ROLE_" + c.role())));
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    static String extractAccessToken(HttpServletRequest req) {
        if (req.getCookies() != null) {
            for (Cookie cookie : req.getCookies()) {
                if (JwtService.COOKIE_ACCESS.equals(cookie.getName()) && !cookie.getValue().isBlank()) {
                    return cookie.getValue();
                }
            }
        }
        String header = req.getHeader("Authorization");
        if (header != null && header.regionMatches(true, 0, "Bearer ", 0, 7)) {
            String t = header.substring(7).trim();
            return t.isEmpty() ? null : t;
        }
        return null;
    }
}
