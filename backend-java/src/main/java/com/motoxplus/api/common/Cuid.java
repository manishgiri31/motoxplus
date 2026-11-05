package com.motoxplus.api.common;

import java.security.SecureRandom;

/**
 * Row id generator for tables Prisma owns. Prisma's {@code @default(cuid())} is
 * applied client-side, so the database has no default — Java must supply one.
 * Prisma never validates id shape on read, so any unique string works; this
 * keeps the familiar "c" + base36 look so mixed rows stay uniform.
 */
public final class Cuid {
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final char[] ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz".toCharArray();

    private Cuid() {}

    public static String next() {
        StringBuilder sb = new StringBuilder(25).append('c');
        sb.append(Long.toString(System.currentTimeMillis(), 36));
        while (sb.length() < 25) {
            sb.append(ALPHABET[RANDOM.nextInt(ALPHABET.length)]);
        }
        return sb.toString();
    }
}
