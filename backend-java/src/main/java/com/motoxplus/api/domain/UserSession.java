package com.motoxplus.api.domain;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;

/** Table "UserSession": one row per refresh-token-backed login. */
@Entity
@Table(name = "UserSession")
public class UserSession {
    @Id
    private String id;
    private String userId;
    private String refreshToken;
    private String deviceInfo;
    private String ipAddress;
    private String userAgent;
    private boolean isActive;
    private LocalDateTime expiresAt;
    private LocalDateTime lastUsedAt;
    private LocalDateTime createdAt;

    protected UserSession() {}

    public UserSession(String id, String userId, String refreshToken, String deviceInfo,
                       String ipAddress, String userAgent, LocalDateTime expiresAt, LocalDateTime now) {
        this.id = id;
        this.userId = userId;
        this.refreshToken = refreshToken;
        this.deviceInfo = deviceInfo;
        this.ipAddress = ipAddress;
        this.userAgent = userAgent;
        this.isActive = true;
        this.expiresAt = expiresAt;
        this.lastUsedAt = now;
        this.createdAt = now;
    }

    public String getId() { return id; }
    public String getUserId() { return userId; }
    public String getRefreshToken() { return refreshToken; }
    public String getDeviceInfo() { return deviceInfo; }
    public String getIpAddress() { return ipAddress; }
    public String getUserAgent() { return userAgent; }
    public boolean isActive() { return isActive; }
    public LocalDateTime getExpiresAt() { return expiresAt; }
    public LocalDateTime getLastUsedAt() { return lastUsedAt; }
    public LocalDateTime getCreatedAt() { return createdAt; }

    public void rotate(String newRefreshToken, String newIp, LocalDateTime now) {
        this.refreshToken = newRefreshToken;
        this.ipAddress = newIp;
        this.lastUsedAt = now;
    }

    public void revoke() { this.isActive = false; }
}
