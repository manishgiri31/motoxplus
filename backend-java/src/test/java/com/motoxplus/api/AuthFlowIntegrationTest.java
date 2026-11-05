package com.motoxplus.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import jakarta.servlet.http.Cookie;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

/**
 * End-to-end auth against a REAL PostgreSQL built from the project's own Prisma schema, so this
 * proves the JPA mappings (named enums, quoted camelCase columns, timestamp(3)) work against the
 * tables Prisma actually creates - something mocks cannot show.
 */
class AuthFlowIntegrationTest extends IntegrationTestBase {

    /** Inserts a dealer user exactly as Prisma would; returns the email. */
    String seedDealer() {
        String id = "u" + UUID.randomUUID().toString().replace("-", "").substring(0, 20);
        String email = id + "@motoxplus.test";
        jdbc.update("""
                INSERT INTO "User" (id, name, email, password, "mobileVerified", "updatedAt")
                VALUES (?, 'Test Dealer', ?, ?, true, now())""", id, email, NODE_BCRYPT_HASH);
        jdbc.update("""
                INSERT INTO "Dealer" (id, "userId", "companyName", "ownerName", phone, state, city, "updatedAt")
                VALUES (?, ?, 'Acme Motors', 'Owner', '9876543210', 'MH', 'Pune', now())""", "d" + id, id);
        return email;
    }

    MvcResult login(String email, String password, String ip) throws Exception {
        return mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .header("X-Real-IP", ip)
                        .header("User-Agent", "JUnit Desktop")
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}"))
                .andReturn();
    }

    @Test
    void loginSetsCookiesAndReturnsTheSameShapeAsTheNodeApp() throws Exception {
        String email = seedDealer();

        MvcResult res = login(email, PASSWORD, "203.0.113.10");

        assertThat(res.getResponse().getStatus()).isEqualTo(200);
        assertThat(res.getResponse().getContentAsString())
                .contains("\"email\":\"" + email + "\"").contains("\"role\":\"DEALER\"")
                .contains("\"dealerStatus\":\"ACTIVE\"").contains("\"vendorStatus\":null")
                .contains("\"mobileVerified\":true").contains("\"emailVerified\":false");
        Cookie access = res.getResponse().getCookie("mx_access");
        Cookie refresh = res.getResponse().getCookie("mx_refresh");
        assertThat(access).isNotNull();
        assertThat(access.isHttpOnly()).isTrue();
        assertThat(access.getMaxAge()).isEqualTo(15 * 60);
        assertThat(refresh).isNotNull();
        assertThat(refresh.getMaxAge()).isEqualTo(7 * 24 * 60 * 60);

        assertThat(jdbc.queryForObject("""
                SELECT count(*) FROM "UserSession" s JOIN "User" u ON u.id = s."userId"
                WHERE u.email = ? AND s."isActive" AND u."lastLogin" IS NOT NULL""", Integer.class, email)).isEqualTo(1);
        assertThat(jdbc.queryForObject("""
                SELECT count(*) FROM "LoginHistory" h JOIN "User" u ON u.id = h."userId"
                WHERE u.email = ? AND h.success AND h.method = 'password-email'""", Integer.class, email)).isEqualTo(1);
    }

    @Test
    void meRequiresAValidSessionAndReturnsProfile() throws Exception {
        String email = seedDealer();
        Cookie access = login(email, PASSWORD, "203.0.113.11").getResponse().getCookie("mx_access");

        mvc.perform(get("/api/auth/me").cookie(access))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.email").value(email))
                .andExpect(jsonPath("$.user.role").value("DEALER"))
                .andExpect(jsonPath("$.user.dealer.companyName").value("Acme Motors"))
                .andExpect(jsonPath("$.user.dealer.status").value("ACTIVE"))
                .andExpect(jsonPath("$.user.admin").doesNotExist());

        mvc.perform(get("/api/auth/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("Unauthorized"));
        mvc.perform(get("/api/auth/me").cookie(new Cookie("mx_access", "garbage")))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void bearerTokenWorksForMobileStyleClients() throws Exception {
        String email = seedDealer();
        String token = login(email, PASSWORD, "203.0.113.12").getResponse().getCookie("mx_access").getValue();

        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.user.email").value(email));
    }

    @Test
    void refreshRotatesTheTokenAndTheOldOneStopsWorking() throws Exception {
        String email = seedDealer();
        Cookie oldRefresh = login(email, PASSWORD, "203.0.113.13").getResponse().getCookie("mx_refresh");
        Thread.sleep(1100); // JWT iat has 1s resolution; ensure the rotated token actually differs

        MvcResult res = mvc.perform(post("/api/auth/refresh").cookie(oldRefresh))
                .andExpect(status().isOk()).andExpect(jsonPath("$.message").value("Tokens refreshed")).andReturn();
        Cookie newRefresh = res.getResponse().getCookie("mx_refresh");
        Cookie newAccess = res.getResponse().getCookie("mx_access");
        assertThat(newRefresh.getValue()).isNotEqualTo(oldRefresh.getValue());

        mvc.perform(get("/api/auth/me").cookie(newAccess)).andExpect(status().isOk());

        MvcResult replay = mvc.perform(post("/api/auth/refresh").cookie(oldRefresh))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("Invalid or expired refresh token")).andReturn();
        assertThat(replay.getResponse().getCookie("mx_refresh").getMaxAge()).isZero();

        mvc.perform(post("/api/auth/refresh")).andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("No refresh token"));
    }

    @Test
    void logoutRevokesTheSessionSoTheStillValidAccessTokenIsRefused() throws Exception {
        String email = seedDealer();
        Cookie access = login(email, PASSWORD, "203.0.113.14").getResponse().getCookie("mx_access");
        mvc.perform(get("/api/auth/me").cookie(access)).andExpect(status().isOk());

        MvcResult out = mvc.perform(post("/api/auth/logout").cookie(access))
                .andExpect(status().isOk()).andExpect(jsonPath("$.message").value("Logged out successfully")).andReturn();
        assertThat(out.getResponse().getCookie("mx_access").getMaxAge()).isZero();

        // The JWT itself has not expired, but its session row is revoked.
        mvc.perform(get("/api/auth/me").cookie(access)).andExpect(status().isUnauthorized());
    }

    @Test
    void logoutWithoutASessionStillSucceeds() throws Exception {
        mvc.perform(post("/api/auth/logout")).andExpect(status().isOk());
    }

    @Test
    void sessionsCanBeListedAndOnlyTheOwnerCanRevoke() throws Exception {
        String emailA = seedDealer();
        String emailB = seedDealer();
        Cookie a = login(emailA, PASSWORD, "203.0.113.15").getResponse().getCookie("mx_access");
        Cookie b = login(emailB, PASSWORD, "203.0.113.16").getResponse().getCookie("mx_access");

        MvcResult list = mvc.perform(get("/api/auth/sessions").cookie(a))
                .andExpect(status().isOk()).andExpect(jsonPath("$.sessions.length()").value(1)).andReturn();
        String currentId = com.jayway.jsonpath.JsonPath.read(list.getResponse().getContentAsString(), "$.currentSessionId");
        String bSessionId = jdbc.queryForObject("""
                SELECT s.id FROM "UserSession" s JOIN "User" u ON u.id = s."userId" WHERE u.email = ?""", String.class, emailB);

        mvc.perform(delete("/api/auth/sessions").cookie(a).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"sessionId\":\"" + bSessionId + "\"}"))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/auth/me").cookie(b)).andExpect(status().isOk());

        mvc.perform(delete("/api/auth/sessions").cookie(a).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"sessionId\":\"" + currentId + "\"}"))
                .andExpect(status().isOk());
        mvc.perform(get("/api/auth/me").cookie(a)).andExpect(status().isUnauthorized());
        mvc.perform(delete("/api/auth/sessions").cookie(b).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void fiveWrongPasswordsLockTheAccountInTheDatabaseEvenForTheRightPassword() throws Exception {
        String email = seedDealer();
        for (int i = 1; i <= 4; i++) {
            MvcResult r = login(email, "wrong-" + i, "198.51.100." + i);
            assertThat(r.getResponse().getStatus()).isEqualTo(401);
            assertThat(r.getResponse().getContentAsString()).contains((5 - i) + " attempt(s) remaining.");
        }
        MvcResult fifth = login(email, "wrong-5", "198.51.100.5");
        assertThat(fifth.getResponse().getStatus()).isEqualTo(423);
        assertThat(fifth.getResponse().getHeader("Retry-After")).isEqualTo("1800");

        assertThat(jdbc.queryForObject("""
                SELECT "failedLoginAttempts" FROM "User" WHERE email = ?""", Integer.class, email)).isEqualTo(5);
        assertThat(jdbc.queryForObject("""
                SELECT "accountLockedUntil" > now() AT TIME ZONE 'UTC' FROM "User" WHERE email = ?""", Boolean.class, email)).isTrue();

        // Layer 1: the 5 failures also exhausted the per-account throttle, which answers first (429),
        // exactly as in the Node app (peek runs before the lock check).
        assertThat(login(email, PASSWORD, "198.51.100.99").getResponse().getStatus()).isEqualTo(429);

        // Layer 2: once that 15-minute throttle window has passed, the DB lock still refuses the
        // CORRECT password (423) - it does not depend on Redis or on the throttle.
        limiter.reset("rl:LOGIN:id:" + email);
        assertThat(login(email, PASSWORD, "198.51.100.99").getResponse().getStatus()).isEqualTo(423);

        // Once the lock lapses the correct password works and the counter resets.
        jdbc.update("""
                UPDATE "User" SET "accountLockedUntil" = now() AT TIME ZONE 'UTC' - interval '1 minute' WHERE email = ?""", email);
        limiter.reset("rl:LOGIN:id:" + email);
        assertThat(login(email, PASSWORD, "198.51.100.98").getResponse().getStatus()).isEqualTo(200);
        assertThat(jdbc.queryForObject("""
                SELECT "failedLoginAttempts" FROM "User" WHERE email = ?""", Integer.class, email)).isZero();
    }

    @Test
    void ipThrottleStopsAnAttackerRotatingAccountsFromOneAddress() throws Exception {
        // 20 failures / 15 min per IP across any accounts; the 21st is throttled before any lookup.
        for (int i = 0; i < 20; i++) {
            assertThat(login("nobody" + i + "@x.test", "x", "192.0.2.77").getResponse().getStatus()).isEqualTo(401);
        }
        MvcResult blocked = login("nobody-final@x.test", "x", "192.0.2.77");
        assertThat(blocked.getResponse().getStatus()).isEqualTo(429);
        assertThat(blocked.getResponse().getHeader("Retry-After")).isNotNull();
    }

    @Test
    void forgedLeadingForwardedForEntryDoesNotEscapeThePerIpThrottle() throws Exception {
        for (int i = 0; i < 20; i++) {
            mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                    .header("X-Forwarded-For", "10.0." + i + ".1, 192.0.2.88") // attacker varies the first hop
                    .content("{\"email\":\"victim" + i + "@x.test\",\"password\":\"x\"}"));
        }
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .header("X-Forwarded-For", "10.9.9.9, 192.0.2.88")
                        .content("{\"email\":\"victim-final@x.test\",\"password\":\"x\"}"))
                .andExpect(status().isTooManyRequests());
    }

    @Test
    void validationAndDisabledAccounts() throws Exception {
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Email or mobile number, and password are required"));
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content("not json"))
                .andExpect(status().isBadRequest());

        String email = seedDealer();
        jdbc.update("UPDATE \"User\" SET \"isActive\" = false WHERE email = ?", email);
        assertThat(login(email, PASSWORD, "203.0.113.20").getResponse().getStatus()).isEqualTo(403);
    }

    @Test
    void loginByMobileNumberInAnyFormat() throws Exception {
        String email = seedDealer();
        String mobile = "9" + String.valueOf(Math.abs(UUID.randomUUID().getMostSignificantBits())).substring(0, 9);
        jdbc.update("UPDATE \"User\" SET \"mobileNumber\" = ? WHERE email = ?", mobile, email);

        MvcResult res = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .header("X-Real-IP", "203.0.113.30")
                .content("{\"mobile\":\"+91 " + mobile + "\",\"password\":\"" + PASSWORD + "\"}")).andReturn();
        assertThat(res.getResponse().getStatus()).isEqualTo(200);
        assertThat(res.getResponse().getContentAsString()).contains(email);
    }

    @Test
    void acceptsATokenMintedByTheNodeApp() throws Exception {
        // The exact access token the Node/jose code produced for user u1 / session s1 (see JwtServiceTest).
        String nodeAccess = "eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiJ1MSIsImVtYWlsIjoiYUBiLmNvbSIsInJvbGUiOiJERUFMRVIiLCJzZXNzaW9uSWQiOiJzMSIsInR5cGUiOiJhY2Nlc3MiLCJpYXQiOjE3OTM4NTM1MTYsImlzcyI6Im1vdG94cGx1cy1hcGkiLCJhdWQiOiJtb3RveHBsdXMtYXBwIiwiZXhwIjoyMTA5MjEzNTE2fQ.tx2uxs76Ys1FaKUXzi2aza9wxK3XhGmiZtFkkM_yPOI";
        jdbc.update("""
                INSERT INTO "User" (id, name, email, password, "updatedAt") VALUES ('u1', 'Node User', 'a@b.com', ?, now())
                ON CONFLICT (id) DO NOTHING""", NODE_BCRYPT_HASH);
        jdbc.update("""
                INSERT INTO "UserSession" (id, "userId", "refreshToken", "expiresAt")
                VALUES ('s1', 'u1', 'node-refresh', now() + interval '7 days') ON CONFLICT (id) DO NOTHING""");

        mvc.perform(get("/api/auth/me").cookie(new Cookie("mx_access", nodeAccess)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.user.email").value("a@b.com"));
    }

    @Test
    void healthEndpointsReportDatabaseAndRedisState() throws Exception {
        mvc.perform(get("/api/health")).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("ok"));
        mvc.perform(get("/api/health/live")).andExpect(status().isOk()).andExpect(jsonPath("$.alive").value(true));
        mvc.perform(get("/api/health/ready")).andExpect(status().isOk())
                .andExpect(jsonPath("$.ready").value(true))
                .andExpect(jsonPath("$.redis").value("down")); // Redis is deliberately unreachable in this test
    }

    @Test
    void oversizedBodiesAreRejectedBeforeParsing() throws Exception {
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + "a".repeat(20_000) + "\",\"password\":\"x\"}"))
                .andExpect(status().isPayloadTooLarge())
                .andExpect(jsonPath("$.code").value("PAYLOAD_TOO_LARGE"));
    }

    @Test
    void otherRoutesAreDeniedByDefault() throws Exception {
        mvc.perform(get("/api/orders")).andExpect(status().isUnauthorized());
    }
}
