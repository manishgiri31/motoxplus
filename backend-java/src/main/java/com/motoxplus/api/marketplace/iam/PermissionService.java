package com.motoxplus.api.marketplace.iam;

import com.motoxplus.api.security.AuthenticatedUser;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

/**
 * Database-driven authorisation: role -> permission codes live in marketplace.role_permission.
 * Used from {@code @PreAuthorize("@perm.has('marketplace.vendor.approve')")} on controllers AND
 * called directly from services ({@link #require}) so rules hold even when a service is reached
 * from a job or another module - never frontend-only.
 * Role lookups are cached briefly; a permission change takes effect within {@link #TTL}.
 */
@org.springframework.boot.autoconfigure.condition.ConditionalOnProperty(name = "marketplace.enabled", havingValue = "true")
@Service("perm")
public class PermissionService {
    static final Duration TTL = Duration.ofSeconds(30);

    private record Cached(Set<String> codes, long loadedAtNanos) {}

    private final JdbcTemplate jdbc;
    private final Map<String, Cached> cache = new ConcurrentHashMap<>();

    public PermissionService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Set<String> permissionsForRole(String role) {
        if (role == null || role.isBlank()) return Set.of();
        long now = System.nanoTime();
        Cached c = cache.get(role);
        if (c != null && now - c.loadedAtNanos < TTL.toNanos()) return c.codes;
        List<String> rows = jdbc.queryForList(
                "SELECT permission_code FROM marketplace.role_permission WHERE role = ?", String.class, role);
        Set<String> codes = Set.copyOf(rows);
        cache.put(role, new Cached(codes, now));
        return codes;
    }

    /** For {@code @PreAuthorize}: checks the authenticated caller of the current request. */
    public boolean has(String permission) {
        Authentication a = SecurityContextHolder.getContext().getAuthentication();
        return a != null && a.getPrincipal() instanceof AuthenticatedUser u && has(u, permission);
    }

    public boolean has(AuthenticatedUser user, String permission) {
        return user != null && permissionsForRole(user.role()).contains(permission);
    }

    /** Service-level guard. */
    public void require(AuthenticatedUser user, String permission) {
        if (!has(user, permission)) {
            throw new AccessDeniedException("Missing permission " + permission);
        }
    }

    /** After an admin edits the mapping (and in tests). */
    public void evictAll() { cache.clear(); }
}
