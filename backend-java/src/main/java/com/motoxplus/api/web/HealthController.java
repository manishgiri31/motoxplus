package com.motoxplus.api.web;

import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Same probe URLs and JSON shapes as src/app/api/health/**. */
@RestController
@RequestMapping("/api/health")
public class HealthController {
    private final JdbcTemplate jdbc;
    private final StringRedisTemplate redis;

    public HealthController(JdbcTemplate jdbc, StringRedisTemplate redis) {
        this.jdbc = jdbc;
        this.redis = redis;
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> health() {
        return noStore(HttpStatus.OK, Map.of("status", "ok"));
    }

    @GetMapping("/live")
    public ResponseEntity<Map<String, Object>> live() {
        return noStore(HttpStatus.OK, Map.of("alive", true, "ts", java.time.Instant.now().toString()));
    }

    /**
     * Readiness depends on the database. Redis is reported too: a missing Redis once
     * silently disabled every rate limit in production while the old probe stayed
     * green, so its state must be visible here even though the app degrades without it.
     */
    @GetMapping("/ready")
    public ResponseEntity<Map<String, Object>> ready() {
        Map<String, Object> body = new LinkedHashMap<>();
        try {
            jdbc.queryForObject("SELECT 1", Integer.class);
        } catch (RuntimeException e) {
            body.put("ready", false);
            body.put("reason", "Database unavailable");
            return noStore(HttpStatus.SERVICE_UNAVAILABLE, body);
        }
        body.put("ready", true);
        body.put("redis", redisUp() ? "up" : "down");
        return noStore(HttpStatus.OK, body);
    }

    private boolean redisUp() {
        try {
            return "PONG".equalsIgnoreCase(redis.execute((org.springframework.data.redis.core.RedisCallback<String>) c -> c.ping()));
        } catch (RuntimeException e) {
            return false;
        }
    }

    private static ResponseEntity<Map<String, Object>> noStore(HttpStatus status, Map<String, Object> body) {
        return ResponseEntity.status(status).cacheControl(CacheControl.noStore()).body(body);
    }
}
