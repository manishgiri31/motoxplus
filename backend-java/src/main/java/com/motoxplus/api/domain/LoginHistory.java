package com.motoxplus.api.domain;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;

/** Table "LoginHistory": append-only audit of login attempts. */
@Entity
@Table(name = "LoginHistory")
public class LoginHistory {
    @Id
    private String id;
    private String userId;
    private boolean success;
    private String method;
    private String reason;
    private String ipAddress;
    private String userAgent;
    private String deviceInfo;
    private LocalDateTime createdAt;

    protected LoginHistory() {}

    public LoginHistory(String id, String userId, boolean success, String method, String reason,
                        String ipAddress, String userAgent, String deviceInfo, LocalDateTime createdAt) {
        this.id = id;
        this.userId = userId;
        this.success = success;
        this.method = method;
        this.reason = reason;
        this.ipAddress = ipAddress;
        this.userAgent = userAgent;
        this.deviceInfo = deviceInfo;
        this.createdAt = createdAt;
    }
}
