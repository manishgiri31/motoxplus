# Behaviour changelog

Record of intentional behaviour changes (not pure refactors/extractions),
with what changed, why, and measured production impact at the time. See
[b2b-b2c-plan.md](./b2b-b2c-plan.md) for the wider Phase 0 context.

---

## 2026-09-18 — Order.gstAmount now sums the rounded line amounts

**Commit:** `8fbf217` (also introduced the B2B/B2C channel seam — this specific
behaviour change should have been its own commit; it wasn't, see note below).

**What changed:** `Order.gstAmount` (and `OrderPricing.gstAmount` in
`src/lib/pricing/compute.ts`) is now computed as the sum of each line's
already-rounded `gstAmount` (`roundToPaise` per line, then sum). The old
`/api/orders` inline logic accumulated the raw, unrounded
`unitPrice * quantity * gstRate / 100` across all lines and rounded that
total once at the end — a separate rounding path from the one that built
each `OrderItem.gstAmount`.

**Why:** Two independent roundings of the same underlying number don't
always agree (classic penny-rounding drift). That could make
`Order.gstAmount` a paisa or two off from `Σ OrderItem.gstAmount` — an
invoice whose printed line amounts don't sum to its own printed total.
Deriving the order-level total from the already-rounded lines guarantees
they always reconcile. Pinned in `golden-b2b-order.test.ts` Fixture D
(357.86 old vs 357.87 new, for that fixture's inputs).

**Impact on new orders:** ₹0.01–₹0.02 difference vs. the old method,
only on orders where the per-line and accumulated-raw roundings would
have landed on different paise. Most orders are unaffected.

**Impact on existing orders:** None — this only changes how new
`Order.gstAmount` values are computed going forward. Old orders keep
whatever value was written at creation time.

**Measured production exposure (2026-09-19, read-only query against
prod DB, before this fix's route.ts change had processed any live
orders):**

```sql
SELECT COUNT(*), SUM(ABS(o."gstAmount" - i.sum_gst))
FROM "Order" o
JOIN (SELECT "orderId", SUM("gstAmount") AS sum_gst
      FROM "OrderItem" GROUP BY "orderId") i ON i."orderId" = o.id
WHERE ABS(o."gstAmount" - i.sum_gst) > 0.001;
```

Result: **0 orders** out of 23 total orders in the table show any
drift between `Order.gstAmount` and `Σ OrderItem.gstAmount`.

**Process note:** this fix shipped bundled inside the same commit as the
pure structural extraction (inline `/api/orders` logic →
`src/lib/pricing/compute.ts`) and the channel-seam scaffolding (migration,
`route.ts`, checkout page). Per this project's commit discipline,
a behaviour change like this belongs in its own commit, separate from
extraction. It wasn't, this time — decision was to document it here
rather than rewrite already-pushed `main` history. Going forward:
extraction commits and behaviour-change commits stay separate.
