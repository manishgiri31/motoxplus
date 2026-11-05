package com.motoxplus.api.auth;

import com.motoxplus.api.domain.Admin;
import com.motoxplus.api.domain.Customer;
import com.motoxplus.api.domain.Dealer;
import com.motoxplus.api.domain.User;
import com.motoxplus.api.domain.Vendor;

/** A user with whichever role profile rows they have (at most one is normally set). */
public record UserWithRelations(User user, Dealer dealer, Vendor vendor, Admin admin, Customer customer) {}
