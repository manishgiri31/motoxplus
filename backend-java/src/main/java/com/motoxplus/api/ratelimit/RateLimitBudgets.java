package com.motoxplus.api.ratelimit;

import static com.motoxplus.api.ratelimit.RateLimiter.FailMode.OPEN;

import com.motoxplus.api.ratelimit.RateLimiter.Budget;

/**
 * Every route-class budget in one place (port of rate-limit-budgets.ts). The
 * numbers are identical to the Node app so behaviour doesn't change when a
 * route moves over. All are fail-open: brute force stays bounded by the
 * DB-backed account lockout and per-account OTP caps, neither of which needs
 * Redis, so a Redis blip degrades this coarse gate instead of taking login down.
 */
public enum RateLimitBudgets {
    /** Each OTP send costs real money (WhatsApp/SMS): strictest of all. */
    OTP_SEND(new Budget(10, 15 * 60, OPEN), new Budget(8, 60, OPEN),
            new Budget(1, 60, OPEN), new Budget(30, 24 * 60 * 60, OPEN)),
    /** Email OTP has no per-send cost, so only a per-IP guard. */
    OTP_SEND_EMAIL(null, new Budget(20, 60, OPEN), null, null),
    OTP_VERIFY(new Budget(8, 15 * 60, OPEN), new Budget(20, 60, OPEN), null, null),
    /** 5 failures / 15 min per identifier, matching the 5-strike account lockout. */
    LOGIN(new Budget(5, 15 * 60, OPEN), new Budget(20, 15 * 60, OPEN), null, null),
    PASSWORD_RESET(new Budget(8, 15 * 60, OPEN), new Budget(20, 15 * 60, OPEN), null, null),
    /** Self-registration: Node's 5/min per IP, plus 5/hour per email so one address can't be hammered. */
    REGISTER(new Budget(5, 60 * 60, OPEN), new Budget(5, 60, OPEN), null, null),
    /** KYC document uploads: generous for retries, bounded so storage can't be flooded. */
    DOCUMENT_UPLOAD(new Budget(40, 60 * 60, OPEN), new Budget(60, 60 * 60, OPEN), null, null),
    /** Vendor listing create/edit/publish/unpublish: room for a day of catalogue work, bounded against scripts. */
    LISTING_WRITE(new Budget(600, 60 * 60, OPEN), new Budget(600, 60 * 60, OPEN), null, null),
    /** Listing photos: up to 8 per listing, several listings an hour. */
    LISTING_IMAGE_UPLOAD(new Budget(200, 60 * 60, OPEN), new Budget(300, 60 * 60, OPEN), null, null),
    /** Public listing photos (storefront grids load many at once, often behind one shared IP). */
    LISTING_IMAGE_PUBLIC(null, new Budget(600, 60, OPEN), null, null),
    /** Vendor warehouse submit/retry: each one can call Delhivery (rate-limited on their side), so keep it tight. */
    WAREHOUSE_WRITE(new Budget(10, 60 * 60, OPEN), new Budget(20, 60 * 60, OPEN), null, null),
    ORDER_CREATE(new Budget(20, 60 * 60, OPEN), new Budget(30, 60 * 60, OPEN), null, null),
    ORDER_CANCEL(new Budget(15, 60 * 60, OPEN), new Budget(30, 60 * 60, OPEN), null, null),
    SCHEME_APPLY(new Budget(20, 60 * 60, OPEN), new Budget(30, 60 * 60, OPEN), null, null),
    SEARCH_PUBLIC(null, new Budget(120, 60, OPEN), null, null),
    /** Site-wide search box (GET /api/search): debounced typing stays well under 60/min per visitor. */
    SEARCH_GROUPED(null, new Budget(60, 60, OPEN), null, null),
    /** Public read-only JSON (e.g. the parts catalogue); own bucket so one chatty endpoint can't starve another. */
    PUBLIC_API(null, new Budget(120, 60, OPEN), null, null),
    DEFAULT(null, new Budget(60, 60, OPEN), null, null);

    private final Budget perIdentifier;
    private final Budget perIp;
    private final Budget perIdentifierBurst;
    private final Budget perIdentifierDaily;

    RateLimitBudgets(Budget perIdentifier, Budget perIp, Budget perIdentifierBurst, Budget perIdentifierDaily) {
        this.perIdentifier = perIdentifier;
        this.perIp = perIp;
        this.perIdentifierBurst = perIdentifierBurst;
        this.perIdentifierDaily = perIdentifierDaily;
    }

    public Budget perIdentifier() { return perIdentifier; }
    public Budget perIp() { return perIp; }
    public Budget perIdentifierBurst() { return perIdentifierBurst; }
    public Budget perIdentifierDaily() { return perIdentifierDaily; }
}
