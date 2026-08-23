import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, type FailMode } from "./rate-limit";
import { getClientIP, UNKNOWN_IP } from "./middleware";

/**
 * Single place for every route-class rate budget. Previously each route
 * called checkIPRateLimit(ip, N, seconds) with its own hand-picked N —
 * reasonable in isolation, but meant the actual policy ("how strict is OTP
 * send vs. login vs. search") was only discoverable by grepping every route
 * file, and per-account budgets didn't exist at all (only per-IP, which an
 * attacker defeats by rotating IPs against a single victim phone/account).
 *
 * failMode:
 *  - "closed": if Redis is unreachable, block the request.
 *  - "open": if Redis is unreachable, fall back to the (weaker, per-worker)
 *    in-memory limiter rather than blocking.
 *
 * LOGIN/OTP_SEND/OTP_VERIFY used to be "closed" on the theory that a
 * determined attacker timing a Redis outage is a smaller worry than the
 * limiter going unenforced — but that made a routine Redis hiccup (or, on a
 * host where Redis was never actually installed, *any* request) a site-wide
 * login/OTP outage: checkRateLimit() returns allowed:false unconditionally
 * in "closed" mode whenever Redis is unreachable, with no in-memory
 * fallback. They're "open" now — brute force is still bounded by the
 * DB-backed account lockout (recordFailedLogin/isAccountLocked in
 * rate-limit.ts, 5 failed attempts -> 30min lock) and the per-account OTP
 * attempt/resend caps (otp.ts), neither of which depends on Redis, so
 * degrading this layer to the per-worker in-memory limiter during an outage
 * doesn't leave login/OTP unprotected — it just makes the *coarse* abuse gate
 * temporarily weaker instead of taking the product down. Genuine
 * cost-sensitive routes (payments, uploads) keep "closed".
 */
interface Budget {
  max: number;
  windowSeconds: number;
  failMode: FailMode;
}

export const RATE_LIMITS = {
  // OTP send: strictest of all. Each send costs real money via WhatsApp/SMS —
  // this is direct cost-of-abuse protection, not just spam prevention.
  OTP_SEND: {
    perIdentifier: { max: 10, windowSeconds: 15 * 60, failMode: "open" } as Budget,
    perIdentifierDaily: { max: 30, windowSeconds: 24 * 60 * 60, failMode: "open" } as Budget,
    perIP: { max: 8, windowSeconds: 60, failMode: "open" } as Budget,
  },
  // Email OTP send: unlike SMS/WhatsApp there's no per-send cost, so no
  // per-identifier or per-day cap on a given email address — only a per-IP
  // guard against a single client hammering the route. failMode "open"
  // because there's no cost at stake if Redis is briefly unreachable.
  OTP_SEND_EMAIL: {
    perIP: { max: 20, windowSeconds: 60, failMode: "open" } as Budget,
  },
  OTP_VERIFY: {
    perIdentifier: { max: 8, windowSeconds: 15 * 60, failMode: "open" } as Budget,
    perIP: { max: 20, windowSeconds: 60, failMode: "open" } as Budget,
  },
  // 5 failed attempts / 15min per identifier, matching the DB-backed account
  // lockout threshold (rate-limit.ts's LOCK_THRESHOLD) so this layer and that
  // one agree on what "too many" means. perIP is looser (20/15min, not
  // 20/60s) since one IP can legitimately be many dealers behind one
  // office/NAT gateway signing in around the same time — a 60s window was
  // tight enough that ordinary concurrent traffic from a shared IP could
  // trip it. Both counters only increment on an actual failed
  // password/lockout check (see credentials.ts) and are cleared on success —
  // a string of successful day-to-day logins no longer erodes the budget.
  LOGIN: {
    perIdentifier: { max: 5, windowSeconds: 15 * 60, failMode: "open" } as Budget,
    perIP: { max: 20, windowSeconds: 15 * 60, failMode: "open" } as Budget,
  },
  // The final step of forgot-password: consumes a resetToken minted by a
  // successful OTP verification. That token is an unguessable 32-byte
  // random value, so this isn't really a brute-forceable surface — this
  // budget is defense-in-depth against a compromised/leaked token being
  // hammered, not the primary control (OTP_VERIFY on the prior step is).
  PASSWORD_RESET: {
    perIdentifier: { max: 8, windowSeconds: 15 * 60, failMode: "open" } as Budget,
    perIP: { max: 20, windowSeconds: 15 * 60, failMode: "open" } as Budget,
  },
  ORDER_CREATE: {
    perIdentifier: { max: 20, windowSeconds: 60 * 60, failMode: "open" } as Budget,
    perIP: { max: 30, windowSeconds: 60 * 60, failMode: "open" } as Budget,
  },
  ORDER_CANCEL: {
    perIdentifier: { max: 15, windowSeconds: 60 * 60, failMode: "open" } as Budget,
    perIP: { max: 30, windowSeconds: 60 * 60, failMode: "open" } as Budget,
  },
  SEARCH_PUBLIC: {
    perIP: { max: 120, windowSeconds: 60, failMode: "open" } as Budget,
  },
  DEFAULT: {
    perIP: { max: 60, windowSeconds: 60, failMode: "open" } as Budget,
  },
} satisfies Record<string, { perIdentifier?: Budget; perIdentifierDaily?: Budget; perIP: Budget }>;

export type RateLimitClass = keyof typeof RATE_LIMITS;

function formatRetryAfter(seconds: number): string {
  if (seconds < 90) return `${Math.max(1, Math.round(seconds))} seconds`;
  const minutes = Math.ceil(seconds / 60);
  return minutes <= 1 ? "a minute" : `${minutes} minutes`;
}

const STANDARD_ERROR = (retryAfterSeconds: number) => {
  const seconds = Math.max(1, Math.ceil(retryAfterSeconds));
  return NextResponse.json(
    { error: `Too many requests. Please try again in ${formatRetryAfter(seconds)}.`, code: "RATE_LIMITED", retryAfterSeconds: seconds },
    { status: 429, headers: { "Retry-After": String(seconds) } }
  );
};

/**
 * Layered per-IP AND per-identifier check for one request. `identifier`
 * should be something the caller controls owning (phone number, account id)
 * — pass it once it's known (e.g. after normalizing the phone from the
 * request body), not the raw unvalidated input.
 *
 * Returns a ready-to-return 429 NextResponse if any layer is exceeded, or
 * null if the request may proceed. Every check for a request class runs
 * (not short-circuited) so a per-IP pass doesn't skip the per-identifier
 * check that actually stops a rotating-IP attack on one victim.
 */
export async function enforceRateLimit(
  req: NextRequest,
  cls: RateLimitClass,
  identifier?: string
): Promise<NextResponse | null> {
  const budget = RATE_LIMITS[cls];
  const ip = getClientIP(req);

  const checks: Promise<{ allowed: boolean; retryAfterSeconds: number }>[] = [];
  if (ip !== UNKNOWN_IP) {
    checks.push(checkRateLimit(`rl:${cls}:ip:${ip}`, budget.perIP));
  } else {
    // Keying on the literal "unknown" would put every client with no
    // resolvable IP in one shared bucket — see UNKNOWN_IP's doc comment.
    // Skip the per-IP layer and rely on the per-identifier one instead.
    console.warn(`[RateLimit] ${cls}: client IP unavailable (no X-Forwarded-For/X-Real-IP) — skipping per-IP check.`);
  }
  if ("perIdentifier" in budget && budget.perIdentifier && identifier) {
    checks.push(checkRateLimit(`rl:${cls}:id:${identifier}`, budget.perIdentifier));
  }
  if ("perIdentifierDaily" in budget && budget.perIdentifierDaily && identifier) {
    checks.push(checkRateLimit(`rl:${cls}:id-daily:${identifier}`, budget.perIdentifierDaily));
  }

  const results = await Promise.all(checks);
  const blocked = results.find((r) => !r.allowed);
  return blocked ? STANDARD_ERROR(blocked.retryAfterSeconds) : null;
}

/**
 * Cheap pre-parse defense: rejects on Content-Length before the body is
 * buffered/parsed at all. Nginx already caps bodies at 20MB globally
 * (nginx.conf client_max_body_size), which is sized for image/document
 * uploads — far too loose for a JSON auth endpoint that should never see
 * more than a few KB. This is a second, tighter gate at the app layer for
 * routes that never handle file uploads.
 */
export function rejectOversizedBody(req: NextRequest, maxBytes: number): NextResponse | null {
  const len = req.headers.get("content-length");
  if (len && Number(len) > maxBytes) {
    return NextResponse.json({ error: "Request body too large.", code: "PAYLOAD_TOO_LARGE" }, { status: 413 });
  }
  return null;
}

export const JSON_BODY_MAX_BYTES = 16 * 1024; // 16KB — generous for any JSON auth/order payload in this app
