package com.motoxplus.api.domain;

import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** Table "Dealer" (only the columns auth needs; grows as modules are ported). */
@Entity
@Table(name = "Dealer")
public class Dealer {
    @Id
    private String id;
    private String userId;
    private String companyName;
    private String gstNumber;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    private DealerStatus status;

    protected Dealer() {}

    public String getId() { return id; }
    public String getUserId() { return userId; }
    public String getCompanyName() { return companyName; }
    public String getGstNumber() { return gstNumber; }
    public DealerStatus getStatus() { return status; }
}
