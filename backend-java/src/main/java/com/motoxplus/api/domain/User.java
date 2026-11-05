package com.motoxplus.api.domain;

import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** Table "User" (Prisma model User). Only the columns the Java API reads or writes. */
@Entity
@Table(name = "User")
public class User {
    @Id
    private String id;
    private String name;
    private String email;
    private LocalDateTime emailVerified;
    private String image;
    private String password;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    private UserRole role;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    private StaffDepartment department;

    private LocalDateTime accountLockedUntil;
    private int failedLoginAttempts;
    private boolean isActive;
    private LocalDateTime lastLogin;
    private String mobileNumber;
    private boolean mobileVerified;
    private boolean twoFactorEnabled;
    private String lastDevice;
    private String lastLoginIP;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    protected User() {}

    public String getId() { return id; }
    public String getName() { return name; }
    public String getEmail() { return email; }
    public LocalDateTime getEmailVerified() { return emailVerified; }
    public String getImage() { return image; }
    public String getPassword() { return password; }
    public UserRole getRole() { return role; }
    public StaffDepartment getDepartment() { return department; }
    public LocalDateTime getAccountLockedUntil() { return accountLockedUntil; }
    public int getFailedLoginAttempts() { return failedLoginAttempts; }
    public boolean isActive() { return isActive; }
    public LocalDateTime getLastLogin() { return lastLogin; }
    public String getMobileNumber() { return mobileNumber; }
    public boolean isMobileVerified() { return mobileVerified; }
    public boolean isTwoFactorEnabled() { return twoFactorEnabled; }
    public String getLastDevice() { return lastDevice; }
    public String getLastLoginIP() { return lastLoginIP; }
    public LocalDateTime getCreatedAt() { return createdAt; }

    public void setFailedLoginAttempts(int v) { this.failedLoginAttempts = v; }
    public void setAccountLockedUntil(LocalDateTime v) { this.accountLockedUntil = v; }
    public void setLastLogin(LocalDateTime v) { this.lastLogin = v; }
    public void setLastDevice(String v) { this.lastDevice = v; }
    public void setLastLoginIP(String v) { this.lastLoginIP = v; }
    public void setUpdatedAt(LocalDateTime v) { this.updatedAt = v; }
}
