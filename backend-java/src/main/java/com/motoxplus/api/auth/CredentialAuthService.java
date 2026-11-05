package com.motoxplus.api.auth;

import com.motoxplus.api.common.Cuid;
import com.motoxplus.api.common.Time;
import com.motoxplus.api.domain.LoginHistory;
import com.motoxplus.api.domain.Repositories.AdminRepository;
import com.motoxplus.api.domain.Repositories.CustomerRepository;
import com.motoxplus.api.domain.Repositories.DealerRepository;
import com.motoxplus.api.domain.Repositories.LoginHistoryRepository;
import com.motoxplus.api.domain.Repositories.UserRepository;
import com.motoxplus.api.domain.Repositories.VendorRepository;
import com.motoxplus.api.domain.User;
import com.motoxplus.api.ratelimit.RateLimitBudgets;
import com.motoxplus.api.ratelimit.RateLimiter;
import com.motoxplus.api.ratelimit.RateLimiter.Result;
import com.motoxplus.api.web.ApiException;
import com.motoxplus.api.web.ClientIp;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

/**
 * The one place password login is verified (port of src/lib/auth/credentials.ts).
 * Order of checks and the exact error messages are kept identical so the existing
 * login form behaves the same against either backend.
 */
@Service
public class CredentialAuthService {
    private static final Logger log = LoggerFactory.getLogger(CredentialAuthService.class);
    // bcryptjs hashes ($2a/$2b) verify under Spring's encoder, so existing passwords keep working.
    private static final BCryptPasswordEncoder BCRYPT = new BCryptPasswordEncoder();

    private final UserRepository users;
    private final DealerRepository dealers;
    private final VendorRepository vendors;
    private final AdminRepository admins;
    private final CustomerRepository customers;
    private final LoginHistoryRepository loginHistory;
    private final AccountLockoutService lockout;
    private final RateLimiter limiter;

    public CredentialAuthService(UserRepository users, DealerRepository dealers, VendorRepository vendors,
                                 AdminRepository admins, CustomerRepository customers,
                                 LoginHistoryRepository loginHistory, AccountLockoutService lockout,
                                 RateLimiter limiter) {
        this.users = users;
        this.dealers = dealers;
        this.vendors = vendors;
        this.admins = admins;
        this.customers = customers;
        this.loginHistory = loginHistory;
        this.lockout = lockout;
        this.limiter = limiter;
    }

    public record Attempt(String identifierRaw, String password, String ip, String userAgent, String deviceInfo) {}

    /** Returns the authenticated user, or throws an {@link ApiException} with the matching status. */
    public UserWithRelations authenticate(Attempt a) {
        Identifier identifier = Identifier.resolve(a.identifierRaw());
        String method = identifier.isMobile() ? "password-mobile" : "password-email";

        // Same LOGIN keyspace as the Node app, whichever endpoint is hit.
        String idKey = "rl:LOGIN:id:" + identifier.value();
        boolean hasKnownIp = a.ip() != null && !ClientIp.UNKNOWN.equals(a.ip());
        String ipKey = hasKnownIp ? "rl:LOGIN:ip:" + a.ip() : null;
        if (a.ip() != null && !hasKnownIp) {
            log.warn("[RateLimit] LOGIN: client IP unavailable - skipping per-IP check.");
        }

        // Peek, don't count: only a real failure should burn the budget.
        List<Result> peeks = new ArrayList<>();
        peeks.add(limiter.peek(idKey, RateLimitBudgets.LOGIN.perIdentifier()));
        if (ipKey != null) peeks.add(limiter.peek(ipKey, RateLimitBudgets.LOGIN.perIp()));
        Optional<Result> blocked = peeks.stream().filter(r -> !r.allowed()).findFirst();
        if (blocked.isPresent()) {
            long retry = blocked.get().retryAfterSeconds();
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS,
                    "Too many login attempts. Please try again in " + minutes(retry) + ".",
                    "RATE_LIMITED", retry);
        }

        Optional<User> found = identifier.isMobile()
                ? users.findByMobileNumber(identifier.value())
                : users.findByEmail(identifier.value());

        if (found.isEmpty() || found.get().getPassword() == null) {
            recordLoginFailure(idKey, ipKey);
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Invalid email/mobile or password");
        }
        User user = found.get();

        if (!user.isActive()) {
            recordLoginFailure(idKey, ipKey);
            logAttempt(user.getId(), false, method, "Account disabled", a);
            throw new ApiException(HttpStatus.FORBIDDEN, "Account has been disabled. Contact support.");
        }

        AccountLockoutService.LockStatus lock = lockout.isAccountLocked(user.getId());
        if (lock.locked()) {
            long secondsLeft = AccountLockoutService.secondsLeft(lock.until())
                    .orElse(AccountLockoutService.LOCK_DURATION_MINUTES * 60L);
            logAttempt(user.getId(), false, method, "Account locked", a);
            throw new ApiException(HttpStatus.LOCKED,
                    "Account locked. Try again in " + minutes(secondsLeft) + ".", null, secondsLeft);
        }

        if (!BCRYPT.matches(a.password(), user.getPassword())) {
            AccountLockoutService.FailedLogin failed = lockout.recordFailedLogin(user.getId());
            recordLoginFailure(idKey, ipKey);
            logAttempt(user.getId(), false, method, "Incorrect password", a);
            if (failed.locked()) {
                long secondsLeft = AccountLockoutService.LOCK_DURATION_MINUTES * 60L;
                throw new ApiException(HttpStatus.LOCKED,
                        "Account locked after too many failed attempts. Try again in " + minutes(secondsLeft) + ".",
                        null, secondsLeft);
            }
            throw new ApiException(HttpStatus.UNAUTHORIZED,
                    "Invalid email/mobile or password. " + failed.attemptsLeft() + " attempt(s) remaining.");
        }

        lockout.clearFailedLogins(user.getId());
        limiter.reset(idKey);
        if (ipKey != null) limiter.reset(ipKey);
        users.recordLoginContext(user.getId(), a.ip(), a.deviceInfo(), Time.utcNow());
        logAttempt(user.getId(), true, method, null, a);

        return new UserWithRelations(user,
                dealers.findByUserId(user.getId()).orElse(null),
                vendors.findByUserId(user.getId()).orElse(null),
                admins.findByUserId(user.getId()).orElse(null),
                customers.findByUserId(user.getId()).orElse(null));
    }

    private void recordLoginFailure(String idKey, String ipKey) {
        limiter.check(idKey, RateLimitBudgets.LOGIN.perIdentifier());
        if (ipKey != null) limiter.check(ipKey, RateLimitBudgets.LOGIN.perIp());
    }

    /** Audit logging must never fail a login, so errors are swallowed (as in the Node version). */
    private void logAttempt(String userId, boolean success, String method, String reason, Attempt a) {
        try {
            loginHistory.save(new LoginHistory(Cuid.next(), userId, success, method, reason,
                    a.ip(), a.userAgent(), a.deviceInfo(), Time.utcNow()));
        } catch (RuntimeException e) {
            log.warn("Could not write login history: {}", e.toString());
        }
    }

    private static String minutes(long seconds) {
        long m = (long) Math.ceil(seconds / 60.0);
        return m <= 1 ? "a minute" : m + " minutes";
    }
}
