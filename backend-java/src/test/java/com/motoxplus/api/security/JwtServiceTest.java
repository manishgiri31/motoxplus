package com.motoxplus.api.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.motoxplus.api.security.JwtService.AccessClaims;
import com.motoxplus.api.security.JwtService.RefreshClaims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import org.junit.jupiter.api.Test;

class JwtServiceTest {
    static final String SECRET = "test-secret-test-secret-test-secret-1234";

    // Minted by the production Node code path (jose: HS256, iss motoxplus-api, aud motoxplus-app)
    // with the secret above. Expiry is ~2036, so these stay valid as fixtures.
    static final String NODE_ACCESS = "eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiJ1MSIsImVtYWlsIjoiYUBiLmNvbSIsInJvbGUiOiJERUFMRVIiLCJzZXNzaW9uSWQiOiJzMSIsInR5cGUiOiJhY2Nlc3MiLCJpYXQiOjE3OTM4NTM1MTYsImlzcyI6Im1vdG94cGx1cy1hcGkiLCJhdWQiOiJtb3RveHBsdXMtYXBwIiwiZXhwIjoyMTA5MjEzNTE2fQ.tx2uxs76Ys1FaKUXzi2aza9wxK3XhGmiZtFkkM_yPOI";
    static final String NODE_REFRESH = "eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiJ1MSIsInNlc3Npb25JZCI6InMxIiwidHlwZSI6InJlZnJlc2giLCJpYXQiOjE3OTM4NTM1MTYsImlzcyI6Im1vdG94cGx1cy1hcGkiLCJhdWQiOiJtb3RveHBsdXMtYXBwIiwiZXhwIjoyMTA5MjEzNTE2fQ.ZsMxNaZmo6Vf6gdzO_yzWnCk84mCkFaXHMkZcqYAu8U";
    static final String NODE_EXPIRED = "eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiJ1MSIsImVtYWlsIjoiYUBiLmNvbSIsInJvbGUiOiJERUFMRVIiLCJzZXNzaW9uSWQiOiJzMSIsInR5cGUiOiJhY2Nlc3MiLCJpYXQiOjE3OTM4NDYzMTYsImlzcyI6Im1vdG94cGx1cy1hcGkiLCJhdWQiOiJtb3RveHBsdXMtYXBwIiwiZXhwIjoxNzkzODQ5OTE2fQ.Ns0QW7MrcdfORkX4Iq097oxX_dRs23EXdZEUx30HY_0";

    final JwtService jwt = new JwtService(SECRET);

    @Test
    void verifiesAccessTokenIssuedByNode() {
        assertThat(jwt.verifyAccessToken(NODE_ACCESS))
                .contains(new AccessClaims("u1", "a@b.com", "DEALER", "s1"));
    }

    @Test
    void verifiesRefreshTokenIssuedByNode() {
        assertThat(jwt.verifyRefreshToken(NODE_REFRESH)).contains(new RefreshClaims("u1", "s1"));
    }

    @Test
    void rejectsExpiredNodeToken() {
        assertThat(jwt.verifyAccessToken(NODE_EXPIRED)).isEmpty();
    }

    @Test
    void roundTripsAccessAndRefresh() {
        String access = jwt.signAccessToken(new AccessClaims("u9", "x@y.com", "ADMIN", "sess9"));
        String refresh = jwt.signRefreshToken(new RefreshClaims("u9", "sess9"));
        assertThat(jwt.verifyAccessToken(access)).contains(new AccessClaims("u9", "x@y.com", "ADMIN", "sess9"));
        assertThat(jwt.verifyRefreshToken(refresh)).contains(new RefreshClaims("u9", "sess9"));
    }

    @Test
    void refreshTokenCannotBeUsedAsAccessTokenAndViceVersa() {
        String access = jwt.signAccessToken(new AccessClaims("u9", "x@y.com", "ADMIN", "sess9"));
        String refresh = jwt.signRefreshToken(new RefreshClaims("u9", "sess9"));
        assertThat(jwt.verifyAccessToken(refresh)).isEmpty();
        assertThat(jwt.verifyRefreshToken(access)).isEmpty();
    }

    @Test
    void rejectsTokenSignedWithAnotherSecret() {
        JwtService other = new JwtService("a-completely-different-secret-value-0000");
        String forged = other.signAccessToken(new AccessClaims("u1", "a@b.com", "SUPER_ADMIN", "s1"));
        assertThat(jwt.verifyAccessToken(forged)).isEmpty();
    }

    @Test
    void rejectsTamperedPayload() {
        String[] parts = NODE_ACCESS.split("\\.");
        String evil = java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(
                "{\"userId\":\"u1\",\"role\":\"SUPER_ADMIN\",\"sessionId\":\"s1\",\"type\":\"access\",\"iss\":\"motoxplus-api\",\"aud\":\"motoxplus-app\",\"exp\":2109213516}"
                        .getBytes(StandardCharsets.UTF_8));
        assertThat(jwt.verifyAccessToken(parts[0] + "." + evil + "." + parts[2])).isEmpty();
    }

    @Test
    void rejectsAlgorithmNoneToken() {
        String header = java.util.Base64.getUrlEncoder().withoutPadding().encodeToString("{\"alg\":\"none\"}".getBytes(StandardCharsets.UTF_8));
        String payload = NODE_ACCESS.split("\\.")[1];
        assertThat(jwt.verifyAccessToken(header + "." + payload + ".")).isEmpty();
    }

    @Test
    void rejectsHs512TokenEvenWithTheRightKey() {
        // A long key makes jjwt happy to verify HS512; we only ever sign HS256, so only accept that.
        String hs512 = Jwts.builder().issuer("motoxplus-api").audience().add("motoxplus-app").and()
                .claim("userId", "u1").claim("email", "a@b.com").claim("role", "DEALER")
                .claim("sessionId", "s1").claim("type", "access")
                .expiration(new Date(System.currentTimeMillis() + 60_000))
                .signWith(Keys.hmacShaKeyFor((SECRET + SECRET).getBytes(StandardCharsets.UTF_8)), Jwts.SIG.HS512)
                .compact();
        JwtService longKey = new JwtService(SECRET + SECRET);
        assertThat(longKey.verifyAccessToken(hs512)).isEmpty();
    }

    @Test
    void rejectsGarbage() {
        assertThat(jwt.verifyAccessToken("not-a-jwt")).isEmpty();
        assertThat(jwt.verifyAccessToken("")).isEmpty();
    }

    @Test
    void refusesToBootWithoutAUsableSecret() {
        assertThatThrownBy(() -> new JwtService("")).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> new JwtService(null)).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> new JwtService("too-short")).isInstanceOf(IllegalStateException.class);
    }
}
