package com.motoxplus.api.auth;

import com.motoxplus.api.common.Cuid;
import com.motoxplus.api.common.Time;
import com.motoxplus.api.domain.Repositories.UserRepository;
import com.motoxplus.api.domain.Repositories.UserSessionRepository;
import com.motoxplus.api.domain.User;
import com.motoxplus.api.domain.UserSession;
import com.motoxplus.api.security.JwtService;
import com.motoxplus.api.security.JwtService.AccessClaims;
import com.motoxplus.api.security.JwtService.RefreshClaims;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Port of src/lib/auth/session.ts. */
@Service
public class SessionService {
    public record Tokens(String accessToken, String refreshToken, String sessionId) {}

    private final JwtService jwt;
    private final UserSessionRepository sessions;
    private final UserRepository users;

    public SessionService(JwtService jwt, UserSessionRepository sessions, UserRepository users) {
        this.jwt = jwt;
        this.sessions = sessions;
        this.users = users;
    }

    @Transactional
    public Tokens createSession(User user, String ip, String userAgent, String deviceInfo) {
        LocalDateTime now = Time.utcNow();
        String sessionId = UUID.randomUUID().toString();

        String refreshToken = jwt.signRefreshToken(new RefreshClaims(user.getId(), sessionId));
        sessions.save(new UserSession(sessionId, user.getId(), refreshToken, deviceInfo, ip, userAgent,
                now.plus(JwtService.REFRESH_TTL), now));

        String accessToken = jwt.signAccessToken(
                new AccessClaims(user.getId(), user.getEmail(), user.getRole().name(), sessionId));
        users.touchLastLogin(user.getId(), now);
        return new Tokens(accessToken, refreshToken, sessionId);
    }

    /** Swaps a valid refresh token for a fresh pair; empty if the token or its session is no longer good. */
    @Transactional
    public Optional<Tokens> rotateSession(String refreshToken, String ip) {
        Optional<RefreshClaims> claims = jwt.verifyRefreshToken(refreshToken);
        if (claims.isEmpty()) return Optional.empty();

        Optional<UserSession> found = sessions.findByRefreshToken(refreshToken);
        if (found.isEmpty()) return Optional.empty();
        UserSession session = found.get();
        LocalDateTime now = Time.utcNow();

        // The JWT's own session id must match the row it unlocked.
        if (!session.getId().equals(claims.get().sessionId())) return Optional.empty();
        if (!session.isActive() || session.getExpiresAt().isBefore(now)) return Optional.empty();

        Optional<User> user = users.findById(session.getUserId());
        if (user.isEmpty()) return Optional.empty();

        String newRefresh = jwt.signRefreshToken(new RefreshClaims(session.getUserId(), session.getId()));
        String newAccess = jwt.signAccessToken(new AccessClaims(
                user.get().getId(), user.get().getEmail(), user.get().getRole().name(), session.getId()));
        session.rotate(newRefresh, ip, now);
        return Optional.of(new Tokens(newAccess, newRefresh, session.getId()));
    }

    @Transactional
    public void revokeSession(String sessionId) {
        sessions.findById(sessionId).ifPresent(UserSession::revoke);
    }

    public int revokeAllSessions(String userId) {
        return sessions.revokeAllForUser(userId);
    }

    public List<UserSession> activeSessions(String userId) {
        return sessions.findActive(userId, Time.utcNow());
    }

    public Optional<UserSession> findSession(String sessionId) {
        return sessions.findById(sessionId);
    }
}
