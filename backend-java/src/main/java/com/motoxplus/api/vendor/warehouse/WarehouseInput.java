package com.motoxplus.api.vendor.warehouse;

/** What the vendor submits. GSTIN is not taken from here: it is the vendor's registered GSTIN. */
public record WarehouseInput(String address, String pin, String city, String state, String phone, String email,
                             Boolean returnSameAsPickup, String returnAddress, String returnPin, String returnCity,
                             String returnState) {}
