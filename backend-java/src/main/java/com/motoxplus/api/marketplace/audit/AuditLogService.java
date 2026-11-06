package com.motoxplus.api.marketplace.audit;

import com.motoxplus.api.common.Cuid;
import com.motoxplus.api.security.AuthenticatedUser;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.json.JsonMapper;

/**
 * Writes marketplace.audit_log (append-only: the table rejects UPDATE/DELETE/TRUNCATE).
 * Propagation is MANDATORY on purpose: an audit row must commit or roll back together with the sensitive
 * action it describes, so callers must already be inside the action's transaction.
 */
@org.springframework.boot.autoconfigure.condition.ConditionalOnProperty(name = "marketplace.enabled", havingValue = "true")
@Service
public class AuditLogService {
    private final JdbcTemplate jdbc;
    private final JsonMapper json;

    public AuditLogService(JdbcTemplate jdbc, JsonMapper json) {
        this.jdbc = jdbc;
        this.json = json;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public String record(AuthenticatedUser actor, String action, String entityType, String entityId,
                         String vendorId, String ip, Map<String, ?> details) {
        String id = Cuid.next();
        jdbc.update("""
                INSERT INTO marketplace.audit_log (id, actor_user_id, actor_role, action, entity_type, entity_id, vendor_id, ip, details)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb)
                """,
                id,
                actor == null ? null : actor.userId(),
                actor == null ? null : actor.role(),
                action, entityType, entityId, vendorId, ip, toJson(details));
        return id;
    }

    private String toJson(Map<String, ?> details) {
        try {
            return json.writeValueAsString(details == null ? Map.of() : details);
        } catch (JacksonException e) {
            throw new IllegalArgumentException("audit details are not serialisable", e);
        }
    }
}
