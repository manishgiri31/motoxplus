package com.motoxplus.api.auth;

import com.motoxplus.api.common.Time;
import com.motoxplus.api.domain.Repositories.AdminRepository;
import com.motoxplus.api.domain.Repositories.DealerRepository;
import com.motoxplus.api.domain.Repositories.UserRepository;
import com.motoxplus.api.domain.User;
import com.motoxplus.api.domain.UserSession;
import com.motoxplus.api.security.AuthenticatedUser;
import com.motoxplus.api.security.JwtService;
import com.motoxplus.api.web.ApiException;
import com.motoxplus.api.web.ClientIp;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Port of src/app/api/auth/{login,refresh,logout,me,sessions}. Same URLs, status
 * codes, cookies and JSON shapes, so Nginx can route these paths to Java with no
 * frontend change.
 *
 * Not ported: the NextAuth session cookie the Node login also mints. It is an
 * encrypted NextAuth JWE that only the Next.js side can produce; it disappears
 * once the frontend stops using NextAuth and reads /api/auth/me instead.
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    public record LoginRequest(String email, String mobile, String password) {}

    public record RevokeRequest(String sessionId) {}

    private final CredentialAuthService credentials;
    private final SessionService sessions;
    private final UserRepository users;
    private final DealerRepository dealers;
    private final AdminRepository admins;
    private final boolean secureCookies;

    public AuthController(CredentialAuthService credentials, SessionService sessions, UserRepository users,
                          DealerRepository dealers, AdminRepository admins,
                          @Value("${app.cookie.secure:false}") boolean secureCookies) {
        this.credentials = credentials;
        this.sessions = sessions;
        this.users = users;
        this.dealers = dealers;
        this.admins = admins;
        this.secureCookies = secureCookies;
    }

    @PostMapping("/login")
    public ResponseEntity<Map<String, Object>> login(@RequestBody(required = false) LoginRequest body, HttpServletRequest req) {
        String raw = body == null ? "" : firstNonBlank(body.email(), body.mobile());
        if (raw.isEmpty() || body.password() == null || body.password().isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Email or mobile number, and password are required");
        }

        String ip = ClientIp.resolve(req);
        String userAgent = req.getHeader("User-Agent");
        String device = ClientIp.deviceInfo(req);

        UserWithRelations u = credentials.authenticate(
                new CredentialAuthService.Attempt(raw, body.password(), ip, userAgent, device));
        SessionService.Tokens tokens = sessions.createSession(u.user(), ip, userAgent, device);

        Map<String, Object> user = new LinkedHashMap<>();
        user.put("id", u.user().getId());
        user.put("name", u.user().getName());
        user.put("email", u.user().getEmail());
        user.put("role", u.user().getRole().name());
        user.put("emailVerified", u.user().getEmailVerified() != null);
        user.put("mobileVerified", u.user().isMobileVerified());
        user.put("dealerStatus", u.dealer() == null ? null : u.dealer().getStatus().name());
        user.put("vendorStatus", u.vendor() == null ? null : u.vendor().getStatus().name());

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, cookie(JwtService.COOKIE_ACCESS, tokens.accessToken(), JwtService.ACCESS_TTL).toString())
                .header(HttpHeaders.SET_COOKIE, cookie(JwtService.COOKIE_REFRESH, tokens.refreshToken(), JwtService.REFRESH_TTL).toString())
                .body(Map.of("user", user));
    }

    @PostMapping("/refresh")
    public ResponseEntity<Map<String, Object>> refresh(HttpServletRequest req) {
        String refreshToken = cookieValue(req, JwtService.COOKIE_REFRESH);
        if (refreshToken == null) throw new ApiException(HttpStatus.UNAUTHORIZED, "No refresh token");

        Optional<SessionService.Tokens> rotated = sessions.rotateSession(refreshToken, ClientIp.resolve(req));
        if (rotated.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .header(HttpHeaders.SET_COOKIE, expired(JwtService.COOKIE_ACCESS).toString())
                    .header(HttpHeaders.SET_COOKIE, expired(JwtService.COOKIE_REFRESH).toString())
                    .body(Map.of("error", "Invalid or expired refresh token"));
        }
        SessionService.Tokens t = rotated.get();
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, cookie(JwtService.COOKIE_ACCESS, t.accessToken(), JwtService.ACCESS_TTL).toString())
                .header(HttpHeaders.SET_COOKIE, cookie(JwtService.COOKIE_REFRESH, t.refreshToken(), JwtService.REFRESH_TTL).toString())
                .body(Map.of("message", "Tokens refreshed"));
    }

    @PostMapping("/logout")
    public ResponseEntity<Map<String, Object>> logout(@AuthenticationPrincipal AuthenticatedUser me) {
        if (me != null && me.sessionId() != null) sessions.revokeSession(me.sessionId());
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, expired(JwtService.COOKIE_ACCESS).toString())
                .header(HttpHeaders.SET_COOKIE, expired(JwtService.COOKIE_REFRESH).toString())
                .body(Map.of("message", "Logged out successfully"));
    }

    @GetMapping("/me")
    public Map<String, Object> me(@AuthenticationPrincipal AuthenticatedUser me) {
        User user = users.findById(me.userId()).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "User not found"));

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", user.getId());
        out.put("name", user.getName());
        out.put("email", user.getEmail());
        out.put("role", user.getRole().name());
        out.put("department", user.getDepartment() == null ? null : user.getDepartment().name());
        out.put("image", user.getImage());
        out.put("emailVerified", Time.iso(user.getEmailVerified()));
        out.put("mobileNumber", user.getMobileNumber());
        out.put("mobileVerified", user.isMobileVerified());
        out.put("twoFactorEnabled", user.isTwoFactorEnabled());
        out.put("lastLogin", Time.iso(user.getLastLogin()));
        out.put("createdAt", Time.iso(user.getCreatedAt()));
        out.put("dealer", dealers.findByUserId(user.getId()).map(d -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", d.getId());
            m.put("companyName", d.getCompanyName());
            m.put("status", d.getStatus().name());
            m.put("gstNumber", d.getGstNumber());
            return m;
        }).orElse(null));
        out.put("admin", admins.findByUserId(user.getId()).map(a -> Map.<String, Object>of("isSuperAdmin", a.isSuperAdmin())).orElse(null));
        return Map.of("user", out);
    }

    @GetMapping("/sessions")
    public Map<String, Object> listSessions(@AuthenticationPrincipal AuthenticatedUser me) {
        List<Map<String, Object>> rows = new ArrayList<>();
        for (UserSession s : sessions.activeSessions(me.userId())) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", s.getId());
            m.put("deviceInfo", s.getDeviceInfo());
            m.put("ipAddress", s.getIpAddress());
            m.put("userAgent", s.getUserAgent());
            m.put("lastUsedAt", Time.iso(s.getLastUsedAt()));
            m.put("createdAt", Time.iso(s.getCreatedAt()));
            m.put("expiresAt", Time.iso(s.getExpiresAt()));
            rows.add(m);
        }
        return Map.of("sessions", rows, "currentSessionId", me.sessionId());
    }

    @DeleteMapping("/sessions")
    public Map<String, Object> revokeSession(@AuthenticationPrincipal AuthenticatedUser me,
                                             @RequestBody(required = false) RevokeRequest body) {
        if (body == null || body.sessionId() == null || body.sessionId().isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Session ID required");
        }
        // Only the owner may revoke; a foreign id is reported as not found, not forbidden.
        UserSession target = sessions.findSession(body.sessionId())
                .filter(s -> s.getUserId().equals(me.userId()))
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Session not found"));
        sessions.revokeSession(target.getId());
        return Map.of("message", "Session revoked");
    }

    private ResponseCookie cookie(String name, String value, Duration maxAge) {
        return ResponseCookie.from(name, value).httpOnly(true).secure(secureCookies)
                .sameSite("Lax").path("/").maxAge(maxAge).build();
    }

    private ResponseCookie expired(String name) {
        return ResponseCookie.from(name, "").httpOnly(true).secure(secureCookies)
                .sameSite("Lax").path("/").maxAge(0).build();
    }

    private static String cookieValue(HttpServletRequest req, String name) {
        if (req.getCookies() == null) return null;
        for (Cookie c : req.getCookies()) {
            if (name.equals(c.getName()) && !c.getValue().isBlank()) return c.getValue();
        }
        return null;
    }

    private static String firstNonBlank(String a, String b) {
        if (a != null && !a.isBlank()) return a.trim();
        if (b != null && !b.isBlank()) return b.trim();
        return "";
    }
}
