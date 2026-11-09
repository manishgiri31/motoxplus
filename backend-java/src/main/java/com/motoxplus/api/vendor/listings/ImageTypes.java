package com.motoxplus.api.vendor.listings;

/**
 * Listing photo types, decided by the file's bytes (magic numbers), never by the client's Content-Type header or file
 * extension, which anyone can set. Same approach as KYC documents (Phase 2).
 */
final class ImageTypes {
    private ImageTypes() {}

    /** "image/jpeg" | "image/png" | "image/webp", or null for anything else (GIF, SVG, HEIC, PDF, HTML ...). */
    static String sniff(byte[] b) {
        if (b == null) return null;
        if (b.length >= 3 && (b[0] & 0xFF) == 0xFF && (b[1] & 0xFF) == 0xD8 && (b[2] & 0xFF) == 0xFF) return "image/jpeg";
        if (b.length >= 8 && (b[0] & 0xFF) == 0x89 && b[1] == 'P' && b[2] == 'N' && b[3] == 'G'
                && b[4] == 0x0D && b[5] == 0x0A && b[6] == 0x1A && b[7] == 0x0A) return "image/png";
        // RIFF....WEBP: bytes 0-3 "RIFF", 8-11 "WEBP"
        if (b.length >= 12 && b[0] == 'R' && b[1] == 'I' && b[2] == 'F' && b[3] == 'F'
                && b[8] == 'W' && b[9] == 'E' && b[10] == 'B' && b[11] == 'P') return "image/webp";
        return null;
    }

    static String extension(String mime) {
        return switch (mime) {
            case "image/png" -> "png";
            case "image/webp" -> "webp";
            default -> "jpg";
        };
    }

    /** A display name only (never used in the storage key): no path, no control characters, at most 200 chars. */
    static String safeFileName(String original, String ext) {
        String n = original == null ? "" : original.replaceAll("^.*[\\\\/]", "").replaceAll("\\p{Cntrl}", "").strip();
        if (n.isEmpty()) n = "photo." + ext;
        return n.length() > 200 ? n.substring(n.length() - 200) : n;
    }
}
