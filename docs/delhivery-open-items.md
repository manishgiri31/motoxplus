# Delhivery Integration — Open Items

Action items and known gaps, as opposed to `delhivery-reference.md` (verified
API facts from live captures). Updated 2026-08-25 after today's tracking/
cancel rewrite (commits `9621cdf`, `4456028`).

## 1. Dealer order cancellation has zero Delhivery awareness

**Why it matters**: a dealer cancelling a `SHIPPED` order today gets a
computed refund from `src/lib/orders/cancellation.ts` — but nothing in that
flow calls Delhivery. The real parcel is never cancelled. That's a live
money/goods leak: refund issued, shipment still in motion.

**Status**: `cancelDelhiveryShipment` exists (`src/lib/delhivery/cancel.ts`,
2026-08-25) but is not called from any route or business logic yet — it's an
unwired library primitive. When this gets wired up, the order matters: call
Delhivery first, compute/issue the refund only once that's accepted — not
the other way around, and not in parallel.

## 2. create.json can still be auto-retried into a duplicate shipment

**Why it matters**: `delhiveryPost` (used by `createDelhiveryShipment`) calls
`delhiveryFetch`, which retries up to 3x by default on 5xx/network errors.
There's no path- or method-based exception for `POST /api/cmu/create.json`.
Delhivery may have already accepted the first attempt before a timeout or
5xx reaches the client — a retry there can create a second real shipment.

**Status**: still open. Flagged in the original Phase 0 audit
(`docs/delhivery-audit.md`) and again while building `cancel.ts` today
(confirmed still live by re-reading `client.ts`). Not fixed in either pass —
out of scope both times, but now flagged three times across two documents.

## 3. normalizeShipmentStatus has no "not picked" mapping

**Why it matters**: a shipment cancelled before pickup reports
`Status.Status: "Not Picked"` (confirmed via live capture). `DELHIVERY_STATUS_MAP`
has no entry that matches it, so it falls through to the generic
`IN_TRANSIT` default — a cancelled shipment currently reads as "in transit"
anywhere `TrackingResult.status` is surfaced.

**Status**: confirmed and asserted directly in `tracking.test.ts` (the test
documents the actual behavior, not a fix). Deferred to the Phase 5 DB-driven
status-mapping redesign (`delhivery_status_map` table) rather than patched
as a one-off code change — that redesign was scoped specifically so mappings
can be corrected without a deploy.

## 4. DelhiveryShipment.OrderType is typed as the literal "Pre-paid" only

**Why it matters**: only one real create.json call has ever been made
(Prepaid, ₹100). The type currently is `OrderType: "Pre-paid"` — a real COD
shipment will almost certainly return a different literal (or this field's
handling breaks entirely) and the type will reject a real, valid response.

**Status**: TODO comment already at the type itself
(`src/lib/delhivery/types.ts`, `DelhiveryShipment.OrderType`). Needs a real
COD shipment capture to confirm and extend the union — do not guess the
literal ahead of that.

## 5. DelhiveryConsignee.Address1 / Address2 populated shape is unverified

**Why it matters**: both fields were captured as empty arrays (`[]`) on a
shipment whose create.json payload *did* contain a real street address —
so either the field is conditionally empty, or Delhivery never echoes it
back at all. Code that assumes a populated shape (string or array of lines)
would be guessing.

**Status**: TODO comment already in code
(`src/lib/delhivery/types.ts`, `DelhiveryConsignee`), typed `string | []` so
the populated case can't be silently assumed. Needs the first real customer
shipment's captured tracking response to resolve.
