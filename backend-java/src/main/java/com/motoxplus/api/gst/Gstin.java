package com.motoxplus.api.gst;

import java.util.Locale;
import java.util.regex.Pattern;

/**
 * GSTIN syntax: 2-digit state code, 10-char PAN, entity number, 'Z', check character. Passing these checks
 * only means the number is well-formed. It says nothing about whether it is registered or active; that is
 * {@link GstinVerificationService}'s job. Same rules as src/lib/gst/gstin.ts.
 */
public final class Gstin {
    private static final Pattern FORMAT = Pattern.compile("^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$");
    private static final String CHARSET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

    private Gstin() {}

    /** Upper-cased with all whitespace removed; null stays null. */
    public static String normalize(String raw) {
        return raw == null ? null : raw.replaceAll("\\s", "").toUpperCase(Locale.ROOT);
    }

    /** Pattern, state code 01-38 (97 = other territory, 99 = centre jurisdiction) and the mod-36 check digit. */
    public static boolean isWellFormed(String gstin) {
        if (gstin == null || !FORMAT.matcher(gstin).matches()) return false;
        int state = Integer.parseInt(gstin.substring(0, 2));
        if (!((state >= 1 && state <= 38) || state == 97 || state == 99)) return false;
        return checkChar(gstin.substring(0, 14)) == gstin.charAt(14);
    }

    /** GSTN's published check-digit algorithm (Luhn mod 36 over the first 14 characters). */
    static char checkChar(String first14) {
        int sum = 0;
        for (int i = 0; i < 14; i++) {
            int value = CHARSET.indexOf(first14.charAt(i));
            int product = value * (i % 2 == 0 ? 1 : 2);
            sum += product / 36 + product % 36;
        }
        return CHARSET.charAt((36 - sum % 36) % 36);
    }
}
