package com.motoxplus.api.marketplace.outbox;

import com.motoxplus.api.common.Cuid;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Transactional outbox. {@link #publish} must run inside the transaction that changes state, so the event
 * exists if and only if the change committed. A relay that delivers pending rows is added with the first
 * consumer (payments/shipping phases).
 */
@org.springframework.boot.autoconfigure.condition.ConditionalOnProperty(name = "marketplace.enabled", havingValue = "true")
@Service
public class OutboxService {
    private final JdbcTemplate jdbc;

    public OutboxService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public String publish(String aggregateType, String aggregateId, String eventType, String payloadJson) {
        String id = Cuid.next();
        jdbc.update("""
                INSERT INTO marketplace.outbox_event (id, aggregate_type, aggregate_id, event_type, payload)
                VALUES (?, ?, ?, ?, ?::jsonb)
                """, id, aggregateType, aggregateId, eventType, payloadJson);
        return id;
    }
}
