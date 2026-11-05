package com.motoxplus.api.domain;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** Table "Admin". */
@Entity
@Table(name = "Admin")
public class Admin {
    @Id
    private String id;
    private String userId;
    private boolean isSuperAdmin;

    protected Admin() {}

    public String getId() { return id; }
    public String getUserId() { return userId; }
    public boolean isSuperAdmin() { return isSuperAdmin; }
}
