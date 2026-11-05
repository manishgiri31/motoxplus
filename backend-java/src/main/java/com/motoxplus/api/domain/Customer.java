package com.motoxplus.api.domain;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** Table "Customer" (B2C profile). */
@Entity
@Table(name = "Customer")
public class Customer {
    @Id
    private String id;
    private String userId;

    protected Customer() {}

    public String getId() { return id; }
    public String getUserId() { return userId; }
}
