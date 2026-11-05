package com.motoxplus.api.ratelimit;

import static org.assertj.core.api.Assertions.assertThat;

import com.motoxplus.api.ratelimit.RateLimiter.Budget;
import com.motoxplus.api.ratelimit.RateLimiter.FailMode;
import org.junit.jupiter.api.Test;

/** Exercises the in-memory path (no Redis), i.e. what runs when Redis is unavailable. */
class RateLimiterTest {
    final RateLimiter limiter = new RateLimiter();
    final Budget threePerMinute = new Budget(3, 60, FailMode.OPEN);

    @Test
    void allowsUpToTheBudgetThenBlocks() {
        for (int i = 0; i < 3; i++) {
            assertThat(limiter.check("k", threePerMinute).allowed()).as("attempt %d", i + 1).isTrue();
        }
        var blocked = limiter.check("k", threePerMinute);
        assertThat(blocked.allowed()).isFalse();
        assertThat(blocked.retryAfterSeconds()).isBetween(1L, 60L);
    }

    @Test
    void bucketsAreIndependentPerKey() {
        for (int i = 0; i < 4; i++) limiter.check("a", threePerMinute);
        assertThat(limiter.check("a", threePerMinute).allowed()).isFalse();
        assertThat(limiter.check("b", threePerMinute).allowed()).isTrue();
    }

    @Test
    void peekReportsStateWithoutCounting() {
        for (int i = 0; i < 20; i++) assertThat(limiter.peek("p", threePerMinute).allowed()).isTrue();
        limiter.check("p", threePerMinute);
        limiter.check("p", threePerMinute);
        assertThat(limiter.peek("p", threePerMinute).allowed()).isTrue();  // 2 of 3 used
        limiter.check("p", threePerMinute);
        assertThat(limiter.peek("p", threePerMinute).allowed()).isFalse(); // 3 of 3 used
    }

    @Test
    void resetClearsTheBucket() {
        for (int i = 0; i < 3; i++) limiter.check("r", threePerMinute);
        assertThat(limiter.peek("r", threePerMinute).allowed()).isFalse();
        limiter.reset("r");
        assertThat(limiter.peek("r", threePerMinute).allowed()).isTrue();
        assertThat(limiter.check("r", threePerMinute).allowed()).isTrue();
    }

    @Test
    void failClosedBudgetBlocksWhenThereIsNoRedis() {
        Budget closed = new Budget(100, 60, FailMode.CLOSED);
        assertThat(limiter.check("c", closed).allowed()).isFalse();
    }

    @Test
    void loginBudgetMatchesTheFiveStrikeLockoutPolicy() {
        assertThat(RateLimitBudgets.LOGIN.perIdentifier().max()).isEqualTo(5);
        assertThat(RateLimitBudgets.LOGIN.perIdentifier().windowSeconds()).isEqualTo(15 * 60);
        assertThat(RateLimitBudgets.OTP_SEND.perIdentifierBurst().max()).isEqualTo(1);
        assertThat(RateLimitBudgets.OTP_SEND.perIdentifierDaily().max()).isEqualTo(30);
    }

    @Test
    void concurrentCallersNeverExceedTheBudget() throws Exception {
        Budget ten = new Budget(10, 60, FailMode.OPEN);
        var allowed = new java.util.concurrent.atomic.AtomicInteger();
        var pool = java.util.concurrent.Executors.newFixedThreadPool(16);
        var tasks = new java.util.ArrayList<java.util.concurrent.Callable<Void>>();
        for (int i = 0; i < 200; i++) {
            tasks.add(() -> { if (limiter.check("race", ten).allowed()) allowed.incrementAndGet(); return null; });
        }
        pool.invokeAll(tasks);
        pool.shutdown();
        assertThat(allowed.get()).isEqualTo(10);
    }
}
