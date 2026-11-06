package com.motoxplus.api.marketplace.iam;

import com.motoxplus.api.security.AuthenticatedUser;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeSet;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Permission introspection for the web/mobile clients (to show or hide UI) and for administrators. */
@ConditionalOnProperty(name = "marketplace.enabled", havingValue = "true")
@RestController
@RequestMapping("/api/v1")
public class IamController {
    private final PermissionService permissions;
    private final JdbcTemplate jdbc;

    public IamController(PermissionService permissions, JdbcTemplate jdbc) {
        this.permissions = permissions;
        this.jdbc = jdbc;
    }

    /** The caller's own role and permission codes. UI hints only: every endpoint re-checks server-side. */
    @GetMapping("/me/permissions")
    public Map<String, Object> myPermissions(@AuthenticationPrincipal AuthenticatedUser user) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("userId", user.userId());
        out.put("role", user.role());
        out.put("permissions", new TreeSet<>(permissions.permissionsForRole(user.role())));
        return out;
    }

    /** Every role with its permission codes. */
    @GetMapping("/admin/rbac/roles")
    @PreAuthorize("@perm.has('marketplace.rbac.view')")
    public Map<String, Object> roles() {
        Map<String, TreeSet<String>> byRole = new LinkedHashMap<>();
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT role, permission_code FROM marketplace.role_permission ORDER BY role, permission_code");
        for (Map<String, Object> r : rows) {
            byRole.computeIfAbsent((String) r.get("role"), k -> new TreeSet<>()).add((String) r.get("permission_code"));
        }
        return Map.of("roles", byRole);
    }
}
