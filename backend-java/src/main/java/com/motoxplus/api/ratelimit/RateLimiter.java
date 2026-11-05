package com.motoxplus.api.ratelimit;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Component;

/**
 * The one primitive every rate limit goes through (port of checkRateLimit /
 * peekRateLimit / resetRateLimit in src/lib/auth/rate-limit.ts).
 *
 * Counters live in Redis under {@code ratelimit:<key>} — the exact keyspace the
 * Node app uses — so while both backends run side by side an attacker can't
 * double their budget by alternating between them. If Redis is unreachable the
 * limiter degrades to a per-process in-memory counter (FailMode.OPEN) or blocks
 * (FailMode.CLOSED), decided per route class in {@link RateLimitBudgets}.
 */
@Component
public class RateLimiter {
    private static final Logger log = LoggerFactory.getLogger(RateLimiter.class);

    public enum FailMode { OPEN, CLOSED }

    public record Budget(int max, int windowSeconds, FailMode failMode) {}

    public record Result(boolean allowed, long retryAfterSeconds) {}

    /**
     * Atomic INCR + EXPIRE-on-first-hit in one round trip. A bare INCR followed
     * by EXPIRE is two commands, so a crash between them leaves a key with no
     * TTL (a permanent ban), and doing EXPIRE every time would slide the window.
     * Returns {count, ttl}.
     */
    private static final DefaultRedisScript<List> INCR_SCRIPT = new DefaultRedisScript<>("""
            local current = redis.call("INCR", KEYS[1])
            if current == 1 then
              redis.call("EXPIRE", KEYS[1], ARGV[1])
            end
            return {current, redis.call("TTL", KEYS[1])}
            """, List.class);

    private static final int MEMORY_PURGE_THRESHOLD = 10_000;

    private record Entry(int count, long resetAtMillis) {}

    private final Map<String, Entry> memory = new ConcurrentHashMap<>();
    private final StringRedisTemplate redis;

    @Autowired
    public RateLimiter(StringRedisTemplate redis) {
        this.redis = redis;
    }

    /** Test seam: a limiter with no Redis, i.e. always on the in-memory path. */
    public RateLimiter() {
        this.redis = null;
    }

    /** Counts this attempt against {@code key} and reports whether it is still within budget. */
    public Result check(String key, Budget budget) {
        if (redis != null) {
            try {
                @SuppressWarnings("unchecked")
                List<Long> res = (List<Long>) redis.execute(
                        INCR_SCRIPT, List.of("ratelimit:" + key), String.valueOf(budget.windowSeconds()));
                if (res != null && res.size() == 2) {
                    long count = res.get(0);
                    long ttl = res.get(1) > 0 ? res.get(1) : budget.windowSeconds();
                    return new Result(count <= budget.max(), ttl);
                }
            } catch (RuntimeException e) {
                log.error("[RateLimit] Redis error: {}", e.toString());
            }
        }
        // Redis unavailable or errored: fail-closed budgets block, fail-open ones
        // degrade to the (weaker, per-process) in-memory counter.
        if (budget.failMode() == FailMode.CLOSED) {
            return new Result(false, budget.windowSeconds());
        }
        return checkInMemory(key, budget);
    }

    /** Read-only: is {@code key} already over budget? Does not count an attempt. */
    public Result peek(String key, Budget budget) {
        if (redis != null) {
            try {
                String redisKey = "ratelimit:" + key;
                String raw = redis.opsForValue().get(redisKey);
                Long ttl = redis.getExpire(redisKey);
                int count = raw == null ? 0 : Integer.parseInt(raw);
                return new Result(count < budget.max(), ttl != null && ttl > 0 ? ttl : budget.windowSeconds());
            } catch (RuntimeException e) {
                log.error("[RateLimit] Redis error on peek: {}", e.toString());
            }
        }
        return peekInMemory(key, budget);
    }

    /** Clears a bucket outright, e.g. after a successful login. */
    public void reset(String key) {
        memory.remove(key);
        if (redis == null) return;
        try {
            redis.delete("ratelimit:" + key);
        } catch (RuntimeException e) {
            log.error("[RateLimit] Redis error on reset: {}", e.toString());
        }
    }

    private Result checkInMemory(String key, Budget budget) {
        long now = System.currentTimeMillis();
        purgeIfLarge(now);
        Entry updated = memory.compute(key, (k, e) -> {
            if (e == null || e.resetAtMillis() < now) {
                return new Entry(1, now + budget.windowSeconds() * 1000L);
            }
            return new Entry(e.count() + 1, e.resetAtMillis());
        });
        long retryAfter = Math.max(1, (long) Math.ceil((updated.resetAtMillis() - now) / 1000.0));
        return new Result(updated.count() <= budget.max(), retryAfter);
    }

    private Result peekInMemory(String key, Budget budget) {
        long now = System.currentTimeMillis();
        Entry e = memory.get(key);
        if (e == null || e.resetAtMillis() < now) return new Result(true, 0);
        long retryAfter = Math.max(1, (long) Math.ceil((e.resetAtMillis() - now) / 1000.0));
        return new Result(e.count() < budget.max(), retryAfter);
    }

    /** Bounded memory without a background thread: sweep expired buckets once the map grows large. */
    private void purgeIfLarge(long now) {
        if (memory.size() > MEMORY_PURGE_THRESHOLD) {
            memory.entrySet().removeIf(en -> en.getValue().resetAtMillis() < now);
        }
    }
}
