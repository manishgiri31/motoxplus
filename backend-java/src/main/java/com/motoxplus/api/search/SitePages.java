package com.motoxplus.api.search;

import java.util.Arrays;
import java.util.List;
import java.util.Locale;

/**
 * The handful of static pages people search for by intent ("return", "gst", "dealer"). Kept in code rather
 * than the database: they change only when a route is added, and that already needs a deploy.
 */
final class SitePages {
    record Page(String title, String url, String snippet, String icon, List<String> keywords) {}

    static final List<Page> ALL = List.of(
            new Page("Contact us", "/contact", "Phone, WhatsApp and email support", "support",
                    List.of("help", "support", "phone", "call", "whatsapp", "email", "address", "contact")),
            new Page("Cancellations & returns", "/cancellation-policy", "Cancel an order or return a part", "support",
                    List.of("cancel", "cancellation", "return", "returns", "refund", "replacement", "exchange")),
            new Page("Become a dealer", "/become-dealer", "Wholesale prices for workshops and retailers", "page",
                    List.of("dealer", "wholesale", "bulk", "b2b", "gst", "retailer", "workshop", "register")),
            new Page("Sell on MotoXPlus", "/become-vendor", "List your parts as a vendor", "page",
                    List.of("vendor", "seller", "sell", "marketplace", "supplier")),
            new Page("Become a supplier", "/become-supplier", "Supply parts to MotoXPlus", "page",
                    List.of("supplier", "manufacturer", "oem", "supply")),
            new Page("About MotoXPlus", "/about", "Who we are", "page",
                    List.of("about", "company", "story")),
            new Page("Terms of service", "/terms", "Terms for using MotoXPlus", "page",
                    List.of("terms", "conditions", "legal", "warranty")),
            new Page("Privacy policy", "/privacy", "How we handle your data", "page",
                    List.of("privacy", "data", "cookies", "personal")));

    private SitePages() {}

    /**
     * A page matches when every word of the query starts a word of its title or keywords, so "ret" finds
     * returns and "dealer gst" finds the dealer page, but "brake" finds nothing here.
     */
    static List<Page> search(String q, int limit) {
        String[] words = q.toLowerCase(Locale.ROOT).split(" ");
        return ALL.stream().filter(p -> {
            List<String> haystack = new java.util.ArrayList<>(p.keywords());
            haystack.addAll(Arrays.asList(p.title().toLowerCase(Locale.ROOT).split("[^\\p{L}\\p{N}]+")));
            return Arrays.stream(words).allMatch(w -> haystack.stream().anyMatch(h -> h.startsWith(w)));
        }).limit(limit).toList();
    }
}
