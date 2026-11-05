package com.motoxplus.api.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jws;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Date;
import java.util.Optional;
import javax.crypto.SecretKey;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Issues and verifies the same tokens as src/lib/auth/jwt.ts: HS256, issuer
 * "motoxplus-api", audience "motoxplus-app", claims {userId,email,role,sessionId,type}.
 * Because the format and secret are shared, a token minted by either backend is
 * accepted by the other, so users stay logged in while modules migrate.
 */
@Service
public class JwtService {
    public static final String COOKIE_ACCESS = "mx_access";
    public static final String COOKIE_REFRESH = "mx_refresh";
    public static final Duration ACCESS_TTL = Duration.ofMinutes(15);
    public static final Duration REFRESH_TTL = Duration.ofDays(7);

    private static final String ISSUER = "motoxplus-api";
    private static final String AUDIENCE = "motoxplus-app";

    private final SecretKey key;

    public JwtService(@Value("${app.jwt.secret:}") String secret) {
        // No fallback secret: signing with a guessable default would silently
        // make every token forgeable, so refuse to boot instead.
        if (secret == null || secret.isBlank()) {
            throw new IllegalStateException("JWT_SECRET must be set - refusing to boot with no secret configured for signing tokens");
        }
        byte[] bytes = secret.getBytes(StandardCharsets.UTF_8);
        if (bytes.length < 32) {
            throw new IllegalStateException("JWT_SECRET must be at least 32 bytes for HS256");
        }
        this.key = Keys.hmacShaKeyFor(bytes);
    }

    public record AccessClaims(String userId, String email, String role, String sessionId) {}

    public record RefreshClaims(String userId, String sessionId) {}

    public String signAccessToken(AccessClaims c) {
        return base()
                .claim("userId", c.userId()).claim("email", c.email())
                .claim("role", c.role()).claim("sessionId", c.sessionId())
                .claim("type", "access")
                .expiration(Date.from(java.time.Instant.now().plus(ACCESS_TTL)))
                .compact();
    }

    public String signRefreshToken(RefreshClaims c) {
        return base()
                .claim("userId", c.userId()).claim("sessionId", c.sessionId())
                .claim("type", "refresh")
                .expiration(Date.from(java.time.Instant.now().plus(REFRESH_TTL)))
                .compact();
    }

    public Optional<AccessClaims> verifyAccessToken(String token) {
        return parse(token, "access").map(c -> new AccessClaims(
                c.get("userId", String.class), c.get("email", String.class),
                c.get("role", String.class), c.get("sessionId", String.class)));
    }

    public Optional<RefreshClaims> verifyRefreshToken(String token) {
        return parse(token, "refresh").map(c -> new RefreshClaims(
                c.get("userId", String.class), c.get("sessionId", String.class)));
    }

    private io.jsonwebtoken.JwtBuilder base() {
        // HS256 is forced: with a 64-byte secret jjwt would otherwise pick HS512.
        return Jwts.builder().issuer(ISSUER).audience().add(AUDIENCE).and()
                .issuedAt(new Date()).signWith(key, Jwts.SIG.HS256);
    }

    private Optional<Claims> parse(String token, String expectedType) {
        try {
            Jws<Claims> jws = Jwts.parser().verifyWith(key)
                    .requireIssuer(ISSUER).requireAudience(AUDIENCE)
                    .build().parseSignedClaims(token);
            // A long key would let HS384/HS512 tokens verify; only accept what we sign.
            if (!"HS256".equals(jws.getHeader().getAlgorithm())) return Optional.empty();
            Claims claims = jws.getPayload();
            if (!expectedType.equals(claims.get("type", String.class))) return Optional.empty();
            return Optional.of(claims);
        } catch (JwtException | IllegalArgumentException e) {
            return Optional.empty();
        }
    }
}
