package com.motoxplus.api.domain;

import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** Table "Vendor" (auth-relevant columns only for now). */
@Entity
@Table(name = "Vendor")
public class Vendor {
    @Id
    private String id;
    private String userId;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    private VendorStatus status;

    protected Vendor() {}

    public String getId() { return id; }
    public String getUserId() { return userId; }
    public VendorStatus getStatus() { return status; }
}
