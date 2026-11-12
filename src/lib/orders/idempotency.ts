import { NextRequest, NextResponse } from "next/server";

// Idempotency for POST /api/orders. The mobile app generates one key per
// checkout attempt and resends it on every retry of "Place order" (e.g. after
// the connection dropped before the response arrived). The key is stored on
// Order.idempotencyKey, unique per owner (dealerId / customerId), so a retry
// returns the order that already exists instead of creating a second one.
//
// Only successful creations are remembered: a request that fails validation
// (empty cart, stock, scheme, address) creates no order, so retrying the same
// key after fixing the cart simply runs again.

export const IDEMPOTENCY_HEADER = "Idempotency-Key";

// UUIDs from the app; allow any opaque token of a sane size and charset.
const KEY_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;

export type IdempotencyKeyResult = { key: string | null; error?: undefined } | { key?: undefined; error: NextResponse };

export function readIdempotencyKey(req: NextRequest): IdempotencyKeyResult {
  const raw = req.headers.get(IDEMPOTENCY_HEADER)?.trim();
  // Optional: the website does not send it, and app builds released before
  // this header existed must keep working. Without it the request behaves as
  // before (no duplicate protection).
  if (!raw) return { key: null };
  if (!KEY_PATTERN.test(raw)) {
    return {
      error: NextResponse.json(
        { error: `Invalid ${IDEMPOTENCY_HEADER} header`, code: "IDEMPOTENCY_KEY_INVALID" },
        { status: 400 }
      ),
    };
  }
  return { key: raw };
}

// True when a create failed only because another request with the same
// owner + key already created its order (the concurrent-retry race).
export function isIdempotencyKeyConflict(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as { code?: unknown; meta?: { target?: unknown } };
  if (e.code !== "P2002") return false;
  const target = e.meta?.target;
  const fields = Array.isArray(target) ? target.map(String) : typeof target === "string" ? [target] : [];
  return fields.some((f) => f.includes("idempotencyKey"));
}

export function replayedOrderResponse(order: unknown): NextResponse {
  // Same status and body shape as a first-time success ({ order }, 200).
  return NextResponse.json({ order }, { status: 200, headers: { "Idempotent-Replayed": "true" } });
}
