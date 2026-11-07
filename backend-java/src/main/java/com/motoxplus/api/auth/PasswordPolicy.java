package com.motoxplus.api.auth;

import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Set;

/** Server-side password rules, identical to validateNewPassword in src/lib/auth/password-policy.ts (same messages). */
public final class PasswordPolicy {
    public static final int MIN_LENGTH = 8;
    public static final int MAX_BYTES = 72; // bcrypt ignores everything after 72 bytes

    private static final Set<String> COMMON = Set.of(
            "password1", "password12", "password123", "password1234", "passw0rd", "p@ssw0rd", "p@ssword1",
            "qwerty123", "qwerty1234", "qwertyuiop1", "1qaz2wsx", "abcd1234", "abc12345", "abcd@1234",
            "welcome1", "welcome123", "admin123", "admin@123", "admin1234", "letmein123", "iloveyou1",
            "india123", "india@123", "india1234", "dealer123", "dealer@123", "12345678", "123456789", "1234567890");

    private PasswordPolicy() {}

    /** A user-facing message, or null when the password is acceptable. */
    public static String validate(String password, String email, String name) {
        if (password == null || password.isEmpty()) return "Password is required";
        if (password.getBytes(StandardCharsets.UTF_8).length > MAX_BYTES) {
            return "Password must be at most " + MAX_BYTES + " bytes long";
        }
        boolean rules = password.length() >= MIN_LENGTH
                && password.chars().anyMatch(c -> c >= 'A' && c <= 'Z')
                && password.chars().anyMatch(c -> c >= 'a' && c <= 'z')
                && password.chars().anyMatch(c -> c >= '0' && c <= '9');
        if (!rules) {
            return "Password must be at least " + MIN_LENGTH + " characters and include an uppercase letter, a lowercase letter, and a number";
        }
        if (isGuessable(password, email, name)) return "That password is too easy to guess. Choose something less predictable.";
        return null;
    }

    static boolean isGuessable(String password, String email, String name) {
        String lower = password.toLowerCase(Locale.ROOT);
        if (COMMON.contains(lower) || lower.contains("motoxplus")) return true;
        if (email != null && email.contains("@")) {
            String local = email.substring(0, email.indexOf('@')).toLowerCase(Locale.ROOT);
            if (local.length() >= 4 && lower.contains(local)) return true;
        }
        if (name != null && !name.isBlank()) {
            String first = name.trim().split("\\s+")[0].toLowerCase(Locale.ROOT);
            if (first.length() >= 4 && lower.contains(first)) return true;
        }
        return false;
    }
}
