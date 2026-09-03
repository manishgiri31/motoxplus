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

## 2. create.json duplicate-shipment risk — RESOLVED (2026-09-03)

**Was**: `delhiveryPost` retried `POST /api/cmu/create.json` up to 3x by
default, and two entry points (auto trigger on order confirmation, manual
admin trigger) could both pass the "does a Shipment row exist?" check and
both POST create.json — either path minting a second real AWB that the
`Shipment.orderId` unique constraint would then only hide.

**Fix**:
- `createDelhiveryShipment` passes `retries: 1` to `delhiveryPost` (single
  attempt, no repeat) — closes the retry variant.
- The create path now runs inside a Prisma interactive transaction that first
  takes a Postgres transaction-scoped advisory lock
  (`pg_advisory_xact_lock(hashtext('delhivery:shipment:<id>'))`), re-checks
  for an existing Shipment row, and only then calls create.json — closes the
  concurrent variant. A fast-path row read outside any transaction keeps the
  common re-entrant case cheap. The unique constraint stays as a last-resort
  backstop (`P2002` handler).
- Both auto call sites go through `autoCreateShipment` (never throws, gated by
  `DELHIVERY_AUTO_SHIPMENT`, records outcome on `OrderEvent`).

See `src/lib/delhivery/shipment.ts`, `auto-shipment.ts`, and their tests.

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

**Now more likely to be hit** (2026-09-03): `createDelhiveryShipment` sends
`payment_mode: "COD"` for both pure COD orders AND `ADVANCE_20` orders (the
80% balance is collected on delivery — `cod_amount = order.amountDue`). COD
create.json / tracking is now a live path, not a hypothetical one. The
tracking parser does not runtime-validate `OrderType`, so a COD literal
won't crash — but capture the first real COD shipment's tracking response
and extend the union.

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
