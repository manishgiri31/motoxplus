import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, type FailMode } from "./rate-limit";
import { getClientIP } from "./middleware";

/**
 * Single place for every route-class rate budget. Previously each route
 * called checkIPRateLimit(ip, N, seconds) with its own hand-picked N —
 * reasonable in isolation, but meant the actual policy ("how strict is OTP
 * send vs. login vs. search") was only discoverable by grepping every route
 * file, and per-account budgets didn't exist at all (only per-IP, which an
 * attacker defeats by rotating IPs against a single victim phone/account).
 *
 * failMode:
 *  - "closed": if Redis is unreachable, block the request. Used for anything
 *    with a direct cost (OTP send costs real money via WhatsApp) or where an
 *    unlimited-during-an-outage window is itself the risk (login/order
 *    mutation brute-forcing). A determined attacker timing a Redis outage is
 *    a much smaller worry than every OTP/login limiter going silently
 *    unenforced for the outage's duration.
 *  - "open": if Redis is unreachable, fall back to the (weaker, per-worker)
 *    in-memory limiter rather than blocking. Used for read-only/public
 *    routes where availability matters more than a perfectly-enforced cap —
 *    a Redis blip shouldn't take the product catalog down.
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
    perIdentifier: { max: 3, windowSeconds: 15 * 60, failMode: "closed" } as Budget,
    perIdentifierDaily: { max: 10, windowSeconds: 24 * 60 * 60, failMode: "closed" } as Budget,
    perIP: { max: 8, windowSeconds: 60, failMode: "closed" } as Budget,
  },
  OTP_VERIFY: {
    perIdentifier: { max: 8, windowSeconds: 15 * 60, failMode: "closed" } as Budget,
    perIP: { max: 20, windowSeconds: 60, failMode: "closed" } as Budget,
  },
  LOGIN: {
    perIdentifier: { max: 10, windowSeconds: 15 * 60, failMode: "closed" } as Budget,
    perIP: { max: 20, windowSeconds: 60, failMode: "closed" } as Budget,
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

const STANDARD_ERROR = (retryAfterSeconds: number) =>
  NextResponse.json(
    { error: "Too many requests. Please try again later.", code: "RATE_LIMITED" },
    { status: 429, headers: { "Retry-After": String(Math.max(1, Math.ceil(retryAfterSeconds))) } }
  );

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

  const checks: Promise<{ allowed: boolean; retryAfterSeconds: number }>[] = [
    checkRateLimit(`rl:${cls}:ip:${ip}`, budget.perIP),
  ];
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
