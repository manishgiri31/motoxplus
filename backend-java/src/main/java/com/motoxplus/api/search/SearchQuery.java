package com.motoxplus.api.search;

/** Input hygiene for the search box: one place that decides what text is allowed to reach SQL. */
final class SearchQuery {
    static final int MIN_LENGTH = 2;
    static final int MAX_LENGTH = 100;

    private SearchQuery() {}

    /**
     * Trims, drops control / zero-width / bidi characters, collapses whitespace runs to one space and caps
     * the length. Returns "" when nothing usable is left (callers treat that as "no query").
     */
    static String clean(String raw) {
        if (raw == null) return "";
        StringBuilder out = new StringBuilder(Math.min(raw.length(), MAX_LENGTH));
        boolean pendingSpace = false;
        for (int i = 0; i < raw.length() && out.length() < MAX_LENGTH; ) {
            int cp = raw.codePointAt(i);
            i += Character.charCount(cp);
            if (Character.isWhitespace(cp) || Character.isSpaceChar(cp)) {
                pendingSpace = out.length() > 0;
                continue;
            }
            int type = Character.getType(cp);
            if (type == Character.CONTROL || type == Character.FORMAT || type == Character.UNASSIGNED
                    || type == Character.PRIVATE_USE || type == Character.SURROGATE) continue;
            if (pendingSpace) {
                out.append(' ');
                pendingSpace = false;
                if (out.length() >= MAX_LENGTH) break;
            }
            if (out.length() + Character.charCount(cp) > MAX_LENGTH) break;
            out.appendCodePoint(cp);
        }
        return out.toString();
    }

    static final int MAX_WORDS = 8;

    /**
     * Lower-cased, de-duplicated words of an already {@link #clean cleaned} query. A plural "s" is trimmed from
     * words of 4+ letters ("brakes" -> "brake", "pads" -> "pad") so a plural query still finds singular names;
     * substring matching then covers the plural itself.
     */
    static java.util.List<String> words(String cleaned) {
        java.util.LinkedHashSet<String> out = new java.util.LinkedHashSet<>();
        for (String w : cleaned.toLowerCase(java.util.Locale.ROOT).split(" ")) {
            if (w.isEmpty()) continue;
            if (w.length() >= 4 && w.endsWith("s") && !w.endsWith("ss")) w = w.substring(0, w.length() - 1);
            out.add(w);
            if (out.size() == MAX_WORDS) break;
        }
        return java.util.List.copyOf(out);
    }

    /** Treats user input as literal text: a typed "%" or "_" must not act as a SQL wildcard. */
    static String escapeLike(String s) {
        return s.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }
}
