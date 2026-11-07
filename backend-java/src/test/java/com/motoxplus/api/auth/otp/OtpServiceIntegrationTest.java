package com.motoxplus.api.auth.otp;

import static org.assertj.core.api.Assertions.assertThat;

import com.motoxplus.api.IntegrationTestBase;
import com.motoxplus.api.auth.otp.OtpService.OtpType;
import java.util.concurrent.Callable;
import java.util.concurrent.Executors;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class OtpServiceIntegrationTest extends IntegrationTestBase {
    private static final String USER = "user-otp-1";

    @Autowired OtpService otp;

    @BeforeEach
    void user() {
        jdbc.update("""
                INSERT INTO "User" (id, name, email, password, "updatedAt") VALUES (?, 'Otp User', 'otp1@example.com', ?, now())
                ON CONFLICT (id) DO NOTHING""", USER, NODE_BCRYPT_HASH);
        jdbc.update("DELETE FROM \"OtpCode\" WHERE \"userId\" = ?", USER);
    }

    @Test
    void hashIsByteForByteTheSameAsNode() {
        // node -e 'crypto.createHmac("sha256", JWT_SECRET).update("otp:user-otp-1:EMAIL_VERIFICATION:123456").digest("hex")'
        assertThat(otp.hash(USER, OtpType.EMAIL_VERIFICATION, "123456"))
                .isEqualTo("e5bdbdadca44880427021c74b04cf16363a5380f88d461b25abeefc88aa24ff3");
    }

    @Test
    void verifiesACodeIssuedByNode() {
        // Row exactly as src/lib/auth/otp.ts createOTP writes it.
        jdbc.update("""
                INSERT INTO "OtpCode" (id, "userId", type, code, "expiresAt", "createdAt")
                VALUES ('node-otp', ?, 'EMAIL_VERIFICATION', 'e5bdbdadca44880427021c74b04cf16363a5380f88d461b25abeefc88aa24ff3',
                        (now() AT TIME ZONE 'UTC') + interval '5 minutes', now() AT TIME ZONE 'UTC')""", USER);
        assertThat(otp.verify(USER, OtpType.EMAIL_VERIFICATION, "123456").success()).isTrue();
    }

    @Test
    void storesOnlyTheHashAndVerifiesOnce() {
        String code = otp.create(USER, OtpType.MOBILE_VERIFICATION);
        assertThat(code).matches("\\d{6}");
        String stored = jdbc.queryForObject("SELECT code FROM \"OtpCode\" WHERE \"userId\" = ? AND used = false", String.class, USER);
        assertThat(stored).hasSize(64).isNotEqualTo(code);

        assertThat(otp.verify(USER, OtpType.MOBILE_VERIFICATION, code).success()).isTrue();
        assertThat(otp.verify(USER, OtpType.MOBILE_VERIFICATION, code).error()).isEqualTo("Invalid or expired OTP");
    }

    @Test
    void codeForOnePurposeDoesNotWorkForAnother() {
        String code = otp.create(USER, OtpType.EMAIL_VERIFICATION);
        assertThat(otp.verify(USER, OtpType.MOBILE_VERIFICATION, code).success()).isFalse();
    }

    @Test
    void newCodeBurnsThePreviousOne() {
        String first = otp.create(USER, OtpType.LOGIN);
        String second = otp.create(USER, OtpType.LOGIN);
        if (!first.equals(second)) {
            assertThat(otp.verify(USER, OtpType.LOGIN, first).success()).isFalse();
        }
        assertThat(otp.verify(USER, OtpType.LOGIN, second).success()).isTrue();
    }

    @Test
    void fiveWrongAttemptsLockTheCodeAndBlockNewSendsDuringCooldown() {
        String code = otp.create(USER, OtpType.LOGIN);
        String wrong = code.equals("000000") ? "111111" : "000000";
        assertThat(otp.verify(USER, OtpType.LOGIN, wrong).error()).isEqualTo("Incorrect OTP. 4 attempt(s) remaining");
        for (int i = 0; i < 3; i++) otp.verify(USER, OtpType.LOGIN, wrong);
        assertThat(otp.verify(USER, OtpType.LOGIN, wrong).error()).isEqualTo("Too many incorrect attempts");
        // Even the right code is refused now, and no fresh code can be requested.
        assertThat(otp.verify(USER, OtpType.LOGIN, code).success()).isFalse();
        assertThat(otp.canSend(USER, OtpType.LOGIN)).isFalse();
    }

    @Test
    void expiredCodeFails() {
        String code = otp.create(USER, OtpType.FORGOT_PASSWORD);
        jdbc.update("UPDATE \"OtpCode\" SET \"expiresAt\" = (now() AT TIME ZONE 'UTC') - interval '1 minute' WHERE \"userId\" = ?", USER);
        assertThat(otp.verify(USER, OtpType.FORGOT_PASSWORD, code).error()).isEqualTo("OTP has expired");
    }

    @Test
    void hourlySendBudget() {
        for (int i = 0; i < 3; i++) otp.create(USER, OtpType.EMAIL_VERIFICATION);
        assertThat(otp.canSend(USER, OtpType.EMAIL_VERIFICATION, 3)).isFalse();
        assertThat(otp.canSend(USER, OtpType.EMAIL_VERIFICATION, 4)).isTrue();
    }

    @Test
    void concurrentDoubleSubmitSucceedsOnlyOnce() throws Exception {
        String code = otp.create(USER, OtpType.MOBILE_VERIFICATION);
        Callable<Boolean> verify = () -> otp.verify(USER, OtpType.MOBILE_VERIFICATION, code).success();
        var pool = Executors.newFixedThreadPool(4);
        try {
            var results = pool.invokeAll(java.util.List.of(verify, verify, verify, verify));
            long wins = 0;
            for (var r : results) if (r.get()) wins++;
            assertThat(wins).isEqualTo(1);
        } finally {
            pool.shutdownNow();
        }
    }
}
