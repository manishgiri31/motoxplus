package com.motoxplus.api.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.motoxplus.api.domain.Repositories.AdminRepository;
import com.motoxplus.api.domain.Repositories.CustomerRepository;
import com.motoxplus.api.domain.Repositories.DealerRepository;
import com.motoxplus.api.domain.Repositories.LoginHistoryRepository;
import com.motoxplus.api.domain.Repositories.UserRepository;
import com.motoxplus.api.domain.Repositories.VendorRepository;
import com.motoxplus.api.domain.User;
import com.motoxplus.api.domain.UserRole;
import com.motoxplus.api.ratelimit.RateLimiter;
import com.motoxplus.api.web.ApiException;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;

class CredentialAuthServiceTest {
    // bcryptjs.hashSync("S3cret!pass", 10) from the production Node library: proves existing hashes still verify.
    static final String NODE_BCRYPT_HASH = "$2b$10$8PG2PHVlnEctuV0l1faYqOalqmFfz/v29RNJ39B6QJmA/UcRO64Xq";
    static final String PASSWORD = "S3cret!pass";

    UserRepository users = mock(UserRepository.class);
    AccountLockoutService lockout = mock(AccountLockoutService.class);
    LoginHistoryRepository history = mock(LoginHistoryRepository.class);
    RateLimiter limiter = new RateLimiter();
    CredentialAuthService service;

    @BeforeEach
    void setUp() {
        DealerRepository dealers = mock(DealerRepository.class);
        VendorRepository vendors = mock(VendorRepository.class);
        AdminRepository admins = mock(AdminRepository.class);
        CustomerRepository customers = mock(CustomerRepository.class);
        when(dealers.findByUserId(anyString())).thenReturn(Optional.empty());
        when(vendors.findByUserId(anyString())).thenReturn(Optional.empty());
        when(admins.findByUserId(anyString())).thenReturn(Optional.empty());
        when(customers.findByUserId(anyString())).thenReturn(Optional.empty());
        when(lockout.isAccountLocked(anyString())).thenReturn(new AccountLockoutService.LockStatus(false, null));
        service = new CredentialAuthService(users, dealers, vendors, admins, customers, history, lockout, limiter);
    }

    static User user(String id, boolean active, String hash) {
        User u = newUser();
        ReflectionTestUtils.setField(u, "id", id);
        ReflectionTestUtils.setField(u, "email", "dealer@motoxplus.com");
        ReflectionTestUtils.setField(u, "password", hash);
        ReflectionTestUtils.setField(u, "isActive", active);
        ReflectionTestUtils.setField(u, "role", UserRole.DEALER);
        return u;
    }

    static User newUser() {
        try {
            var ctor = User.class.getDeclaredConstructor();
            ctor.setAccessible(true);
            return ctor.newInstance();
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException(e);
        }
    }

    CredentialAuthService.Attempt attempt(String id, String pw) {
        return new CredentialAuthService.Attempt(id, pw, "203.0.113.5", "JUnit", "Desktop");
    }

    @Test
    void acceptsAPasswordHashedByBcryptjsAndNormalizesTheEmail() {
        User u = user("u1", true, NODE_BCRYPT_HASH);
        when(users.findByEmail("dealer@motoxplus.com")).thenReturn(Optional.of(u));

        UserWithRelations result = service.authenticate(attempt("  Dealer@MotoXPlus.com ", PASSWORD));

        assertThat(result.user().getId()).isEqualTo("u1");
        verify(lockout).clearFailedLogins("u1");
        verify(users).recordLoginContext(any(), any(), any(), any());
    }

    @Test
    void looksUpMobileNumbersInAnyCommonFormat() {
        User u = user("u2", true, NODE_BCRYPT_HASH);
        when(users.findByMobileNumber("9876543210")).thenReturn(Optional.of(u));

        assertThat(service.authenticate(attempt("+91 98765 43210", PASSWORD)).user().getId()).isEqualTo("u2");
    }

    @Test
    void unknownUserGetsTheSameGenericMessageAsAWrongPassword() {
        when(users.findByEmail(anyString())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.authenticate(attempt("ghost@x.com", "whatever")))
                .isInstanceOfSatisfying(ApiException.class, e -> {
                    assertThat(e.status()).isEqualTo(HttpStatus.UNAUTHORIZED);
                    assertThat(e.getMessage()).isEqualTo("Invalid email/mobile or password");
                });
    }

    @Test
    void wrongPasswordReportsRemainingAttempts() {
        when(users.findByEmail(anyString())).thenReturn(Optional.of(user("u1", true, NODE_BCRYPT_HASH)));
        when(lockout.recordFailedLogin("u1")).thenReturn(new AccountLockoutService.FailedLogin(false, 3));

        assertThatThrownBy(() -> service.authenticate(attempt("dealer@motoxplus.com", "nope")))
                .isInstanceOfSatisfying(ApiException.class, e -> {
                    assertThat(e.status()).isEqualTo(HttpStatus.UNAUTHORIZED);
                    assertThat(e.getMessage()).endsWith("3 attempt(s) remaining.");
                });
        verify(lockout, never()).clearFailedLogins(anyString());
    }

    @Test
    void fifthWrongPasswordLocksTheAccountWith423() {
        when(users.findByEmail(anyString())).thenReturn(Optional.of(user("u1", true, NODE_BCRYPT_HASH)));
        when(lockout.recordFailedLogin("u1")).thenReturn(new AccountLockoutService.FailedLogin(true, 0));

        assertThatThrownBy(() -> service.authenticate(attempt("dealer@motoxplus.com", "nope")))
                .isInstanceOfSatisfying(ApiException.class, e -> {
                    assertThat(e.status()).isEqualTo(HttpStatus.LOCKED);
                    assertThat(e.retryAfterSeconds()).isEqualTo(30 * 60L);
                });
    }

    @Test
    void lockedAccountIsRejectedWithoutCheckingThePassword() {
        when(users.findByEmail(anyString())).thenReturn(Optional.of(user("u1", true, NODE_BCRYPT_HASH)));
        when(lockout.isAccountLocked("u1")).thenReturn(
                new AccountLockoutService.LockStatus(true, LocalDateTime.now(ZoneOffset.UTC).plusMinutes(10)));

        // Correct password, still refused: a locked account must not be probeable.
        assertThatThrownBy(() -> service.authenticate(attempt("dealer@motoxplus.com", PASSWORD)))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status()).isEqualTo(HttpStatus.LOCKED));
        verify(lockout, never()).recordFailedLogin(anyString());
    }

    @Test
    void disabledAccountGets403() {
        when(users.findByEmail(anyString())).thenReturn(Optional.of(user("u1", false, NODE_BCRYPT_HASH)));

        assertThatThrownBy(() -> service.authenticate(attempt("dealer@motoxplus.com", PASSWORD)))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status()).isEqualTo(HttpStatus.FORBIDDEN));
    }

    @Test
    void userWithoutAPasswordCannotLogInWithOne() {
        when(users.findByEmail(anyString())).thenReturn(Optional.of(user("u1", true, null)));

        assertThatThrownBy(() -> service.authenticate(attempt("dealer@motoxplus.com", PASSWORD)))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status()).isEqualTo(HttpStatus.UNAUTHORIZED));
    }

    @Test
    void sixthFailedAttemptIsThrottledByTheRateLimitBeforeTouchingTheDatabase() {
        when(users.findByEmail(anyString())).thenReturn(Optional.empty());
        for (int i = 0; i < 5; i++) {
            assertThatThrownBy(() -> service.authenticate(attempt("ghost@x.com", "x")))
                    .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status()).isEqualTo(HttpStatus.UNAUTHORIZED));
        }
        org.mockito.Mockito.clearInvocations(users);

        assertThatThrownBy(() -> service.authenticate(attempt("ghost@x.com", "x")))
                .isInstanceOfSatisfying(ApiException.class, e -> {
                    assertThat(e.status()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
                    assertThat(e.retryAfterSeconds()).isPositive();
                });
        verify(users, never()).findByEmail(anyString());
    }

    @Test
    void successfulLoginDoesNotBurnTheRateLimitBudget() {
        when(users.findByEmail(anyString())).thenReturn(Optional.of(user("u1", true, NODE_BCRYPT_HASH)));
        for (int i = 0; i < 10; i++) {
            assertThat(service.authenticate(attempt("dealer@motoxplus.com", PASSWORD)).user().getId()).isEqualTo("u1");
        }
    }
}
