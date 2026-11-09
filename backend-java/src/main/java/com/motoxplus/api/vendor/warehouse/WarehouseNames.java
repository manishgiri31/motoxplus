package com.motoxplus.api.vendor.warehouse;

import java.util.Locale;

/**
 * Delhivery warehouse names for vendors: {@code VND-<vendorCode>-<pin>}, uppercase, only A-Z, 0-9 and hyphen.
 * The name is permanent on Delhivery (it cannot be renamed), so it is derived from values that never change for a
 * vendor (the vendor code) plus the PIN it collects from.
 */
public final class WarehouseNames {
    private WarehouseNames() {}

    public static String forVendor(String vendorCode, String pin) {
        String raw = "VND-" + (vendorCode == null ? "" : vendorCode) + "-" + (pin == null ? "" : pin);
        String cleaned = raw.toUpperCase(Locale.ROOT)
                .replaceAll("[^A-Z0-9-]", "")
                .replaceAll("-{2,}", "-")
                .replaceAll("^-|-$", "");
        if (!cleaned.matches("^VND-[A-Z0-9]+(-[A-Z0-9]+)*-[0-9]{6}$")) {
            throw new IllegalArgumentException("Cannot build a warehouse name from vendor code '" + vendorCode + "' and PIN '" + pin + "'");
        }
        return cleaned;
    }

    /** Null when the name fits; otherwise why not. {@code maxLength <= 0} means the limit is not confirmed yet. */
    public static String lengthProblem(String name, int maxLength) {
        if (maxLength <= 0) return null; // unconfirmed: DelhiveryClient refuses to send anyway
        return name.length() <= maxLength ? null
                : "Warehouse name " + name + " is " + name.length() + " characters; Delhivery allows " + maxLength;
    }
}
