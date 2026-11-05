package com.motoxplus.api.ratelimit;

import com.motoxplus.api.ratelimit.RateLimiter.Budget;
import com.motoxplus.api.ratelimit.RateLimiter.Result;
import com.motoxplus.api.web.ApiException;
import com.motoxplus.api.web.ClientIp;
import jakarta.servlet.http.HttpServletRequest;
import java.util.ArrayList;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/** Layered per-IP AND per-identifier check for one request (port of enforceRateLimit). */
@Component
public class RateLimitEnforcer {
    private static final Logger log = LoggerFactory.getLogger(RateLimitEnforcer.class);

    private final RateLimiter limiter;

    public RateLimitEnforcer(RateLimiter limiter) {
        this.limiter = limiter;
    }

    /**
     * Throws a 429 {@link ApiException} if any layer is exceeded. Every layer is
     * evaluated (no short-circuit) so passing the per-IP check never skips the
     * per-identifier one that actually stops a rotating-IP attack on one victim.
     */
    public void enforce(HttpServletRequest req, RateLimitBudgets cls, String identifier) {
        String ip = ClientIp.resolve(req);
        List<Result> results = new ArrayList<>();

        if (cls.perIp() != null) {
            if (!ClientIp.UNKNOWN.equals(ip)) {
                results.add(limiter.check("rl:" + cls + ":ip:" + ip, cls.perIp()));
            } else {
                // One shared "unknown" bucket would rate-limit every client with no
                // resolvable IP together; rely on the per-identifier layer instead.
                log.warn("[RateLimit] {}: client IP unavailable (no X-Real-IP/X-Forwarded-For) - skipping per-IP check.", cls);
            }
        }
        if (identifier != null) {
            addIdentifierLayer(results, "id", cls.perIdentifier(), cls, identifier);
            addIdentifierLayer(results, "id-burst", cls.perIdentifierBurst(), cls, identifier);
            addIdentifierLayer(results, "id-daily", cls.perIdentifierDaily(), cls, identifier);
        }

        results.stream().filter(r -> !r.allowed()).findFirst()
                .ifPresent(r -> { throw ApiException.rateLimited(r.retryAfterSeconds()); });
    }

    private void addIdentifierLayer(List<Result> out, String layer, Budget budget, RateLimitBudgets cls, String identifier) {
        if (budget != null) out.add(limiter.check("rl:" + cls + ":" + layer + ":" + identifier, budget));
    }
}
