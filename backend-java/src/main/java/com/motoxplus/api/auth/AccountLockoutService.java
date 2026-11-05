package com.motoxplus.api.auth;

import com.motoxplus.api.common.Time;
import com.motoxplus.api.domain.Repositories.UserRepository;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * DB-backed brute-force lockout (port of recordFailedLogin/isAccountLocked in
 * rate-limit.ts): 5 wrong passwords lock the account for 30 minutes. Lives in
 * the database on purpose so it keeps working when Redis is down.
 */
@Service
public class AccountLockoutService {
    public static final int LOCK_THRESHOLD = 5;
    public static final int LOCK_DURATION_MINUTES = 30;

    public record FailedLogin(boolean locked, int attemptsLeft) {}

    public record LockStatus(boolean locked, LocalDateTime until) {}

    private final UserRepository users;

    public AccountLockoutService(UserRepository users) {
        this.users = users;
    }

    @Transactional
    public FailedLogin recordFailedLogin(String userId) {
        LocalDateTime now = Time.utcNow();
        users.incrementFailedLogins(userId, now);
        Integer attempts = users.failedLoginAttempts(userId);
        int count = attempts == null ? LOCK_THRESHOLD : attempts;

        if (count >= LOCK_THRESHOLD) {
            users.lockUntil(userId, now.plus(Duration.ofMinutes(LOCK_DURATION_MINUTES)), now);
            return new FailedLogin(true, 0);
        }
        return new FailedLogin(false, LOCK_THRESHOLD - count);
    }

    public void clearFailedLogins(String userId) {
        users.clearLockout(userId, Time.utcNow());
    }

    @Transactional
    public LockStatus isAccountLocked(String userId) {
        LocalDateTime until = users.lockedUntil(userId);
        if (until == null) return new LockStatus(false, null);
        if (until.isAfter(Time.utcNow())) return new LockStatus(true, until);

        // Lock expired: auto-unlock so the counter starts from zero again.
        clearFailedLogins(userId);
        return new LockStatus(false, null);
    }

    static Optional<Long> secondsLeft(LocalDateTime until) {
        if (until == null) return Optional.empty();
        long secs = Duration.between(Time.utcNow(), until).toSeconds();
        return Optional.of(Math.max(1, secs));
    }
}
