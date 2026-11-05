package com.motoxplus.api.common;

import java.util.regex.Pattern;

/** Port of src/lib/phone.ts. */
public final class PhoneUtil {
    private static final Pattern MOBILE = Pattern.compile("^[6-9]\\d{9}$");
    private static final Pattern SEPARATORS = Pattern.compile("[\\s-]");

    private PhoneUtil() {}

    /**
     * Normalizes an Indian mobile number to its bare 10-digit form. Accepts +91,
     * 91 (12 digits with country code), a leading 0 (11 digits), and embedded
     * spaces/hyphens. Returns null when the input isn't a valid Indian mobile.
     */
    public static String normalizeIndianMobile(String input) {
        if (input == null || input.isBlank()) return null;
        String digits = SEPARATORS.matcher(input.trim()).replaceAll("");

        if (digits.startsWith("+91")) {
            digits = digits.substring(3);
        } else if (digits.startsWith("91") && digits.length() == 12) {
            digits = digits.substring(2);
        } else if (digits.startsWith("0") && digits.length() == 11) {
            digits = digits.substring(1);
        }
        return MOBILE.matcher(digits).matches() ? digits : null;
    }
}
