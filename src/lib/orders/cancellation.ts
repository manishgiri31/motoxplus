import { roundToPaise } from "@/lib/utils";
import { POST_PICKUP_SHIPMENT_STATUSES } from "@/lib/delhivery/carrier-status";
import type { CarrierTier } from "@/lib/delhivery/carrier-cancellation";

/**
 * Stage-based cancellation fee: the later a dealer cancels, the more it
 * costs them. Fee is a percentage of amountPaid (money actually captured —
 * correct for ADVANCE_20 orders where the balance was never collected).
 * COD orders have amountPaid = 0, so pre-shipping COD cancellations
 * naturally cost ₹0 with no special-casing beyond the post-shipping block.
 *
 * This is the single source of truth for fee numbers — the preview endpoint,
 * the cancel endpoint, and the tests all call it. The client never
 * computes a fee; the server always recalculates from the order's current
 * status at the moment of cancellation.
 *
 * Percentages are DB-configurable (CancellationPolicy, admin/settings) — this
 * module stays pure and DB-free so it's unit-testable without mocking Prisma;
 * callers (API routes) fetch the policy row and pass the numbers in.
 */

export type OrderStatusForCancellation =
  | "PENDING"
  | "CONFIRMED"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "RETURNED";

export type PaymentTypeForCancellation = "ADVANCE_20" | "FULL_100" | "COD";

export type CancellationStage = "PRE_SHIP" | "POST_SHIP";

export type CancellationBlockCode =
  | "ALREADY_CANCELLED"
  | "DELIVERED"
  | "RETURNED"
  | "COD_AFTER_SHIPPING";

export type CancellationEligibility =
  | { ok: true; stage: CancellationStage; feePercent: number }
  | { ok: false; code: CancellationBlockCode; message: string };

export interface CancellationPolicyInput {
  preShipChargePercent: number;
  postShipChargePercent: number;
}

/** Falls back to the schema defaults if the CancellationPolicy row is ever missing. */
export const DEFAULT_CANCELLATION_POLICY: CancellationPolicyInput = {
  preShipChargePercent: 2.0,
  postShipChargePercent: 20.0,
};

const RETURN_FLOW_HINT =
  "This order can no longer be cancelled. Please use the return/refund flow instead.";

/**
 * PENDING/CONFIRMED/PROCESSING → PRE_SHIP; SHIPPED → POST_SHIP.
 * OrderStatus has no distinct "packed" value — PROCESSING covers it. It also
 * has no "in transit" value — SHIPPED covers both "shipped" and "in transit"
 * at the Order.status level (shipment-leg tracking lives on the separate
 * Shipment/ShipmentStatus model and never writes back to Order.status).
 */
const STAGE_BY_STATUS: Partial<Record<OrderStatusForCancellation, CancellationStage>> = {
  PENDING: "PRE_SHIP",
  CONFIRMED: "PRE_SHIP",
  PROCESSING: "PRE_SHIP",
  SHIPPED: "POST_SHIP",
};

export function stageOf(status: OrderStatusForCancellation): CancellationStage | null {
  return STAGE_BY_STATUS[status] ?? null;
}

export function evaluateCancellation(params: {
  status: OrderStatusForCancellation;
  paymentType: PaymentTypeForCancellation;
  policy: CancellationPolicyInput;
}): CancellationEligibility {
  const { status, paymentType, policy } = params;

  if (status === "CANCELLED") {
    return { ok: false, code: "ALREADY_CANCELLED", message: "This order has already been cancelled." };
  }
  if (status === "DELIVERED") {
    return { ok: false, code: "DELIVERED", message: RETURN_FLOW_HINT };
  }
  if (status === "RETURNED") {
    return { ok: false, code: "RETURNED", message: RETURN_FLOW_HINT };
  }
  if (status === "SHIPPED" && paymentType === "COD") {
    // TODO(business-decision): shipped COD orders are blocked outright rather
    // than charged post-ship % of ₹0 — COD has no captured payment to deduct
    // a fee from, and the dealer already has (or is about to receive) goods,
    // so silently "allowing" cancellation here would look like a free
    // post-ship cancellation with no consequence. Support currently handles
    // these manually (refuse-at-door / return flow). Revisit if there's ever
    // a way to bill a COD dealer directly instead of deducting from a refund.
    return {
      ok: false,
      code: "COD_AFTER_SHIPPING",
      message: "Shipped COD orders cannot be cancelled online, contact support.",
    };
  }

  const stage = STAGE_BY_STATUS[status];
  if (!stage) {
    // Any OrderStatus not covered above (defensive — the enum is closed,
    // but a future added status should fail closed, not silently allow).
    return { ok: false, code: "RETURNED", message: RETURN_FLOW_HINT };
  }

  const feePercent = stage === "PRE_SHIP" ? policy.preShipChargePercent : policy.postShipChargePercent;
  return { ok: true, stage, feePercent };
}

export interface CancellationQuote {
  feePercent: number;
  feeAmount: number;
  refundAmount: number;
  /**
   * True when feeAmount rounds to 0 — e.g. pure COD with amountPaid 0
   * pre-ship (feePercent% of ₹0 is ₹0). Distinct from an admin's manual
   * waive (OrderCancellation.waived + waivedByUserId): this is just the
   * arithmetic outcome, not an override, but the UI shows both as "waived".
   */
  waived: boolean;
}

export function calculateCancellation(params: {
  feePercent: number;
  amountPaid: number;
}): CancellationQuote {
  const feeAmount = roundToPaise((params.amountPaid * params.feePercent) / 100);
  // floor at 0 — defensive only; feePercent/amountPaid are never negative in
  // practice, so feeAmount can never legitimately exceed amountPaid.
  const refundAmount = roundToPaise(Math.max(0, params.amountPaid - feeAmount));
  return { feePercent: params.feePercent, feeAmount, refundAmount, waived: feeAmount === 0 };
}

export const CANCELLABLE_STATUSES: OrderStatusForCancellation[] = ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED"];

/**
 * TEMPORARY STOPGAP — see docs/delhivery-open-items.md item 1. Does NOT
 * touch evaluateCancellation/calculateCancellation above: those still
 * correctly return ok:true/POST_SHIP/20% for a SHIPPED FULL_100 or
 * ADVANCE_20 order (see cancellation.test.ts) — that's the real,
 * admin-usable eligibility. This is a separate, additive check callers use
 * to block the DEALER path specifically, on top of that.
 *
 * Why: cancelDelhiveryShipment (src/lib/delhivery/cancel.ts) exists but is
 * not wired to any route yet. Today, a dealer self-cancelling a SHIPPED
 * order gets a refund computed and nothing cancels the real Delhivery
 * parcel — it keeps moving. Block dealer self-cancellation once SHIPPED
 * until that's wired in properly; leave admin-initiated cancellation
 * untouched (admins can still act as needed).
 *
 * Only SHIPPED is checked, not "SHIPPED and later": OrderStatus has no
 * separate "out for delivery"/"in transit" value between SHIPPED and
 * DELIVERED (shipment-leg tracking lives on the separate Shipment model),
 * and DELIVERED/CANCELLED/RETURNED are already blocked for everyone by
 * evaluateCancellation above regardless of actor.
 */
export function isDealerPostShipBlocked(status: OrderStatusForCancellation, isDealerActor: boolean): boolean {
  return isDealerActor && status === "SHIPPED";
}

export const DEALER_POST_SHIP_BLOCK_MESSAGE =
  "This order has already shipped and can no longer be cancelled online. Please contact support.";

// ─── Carrier-aware dealer cancellation gate (F-02 / F-04) ─────────────────────
//
// AWB creation is EARLY in this system — COD at order placement, prepaid at
// capture — so "a waybill exists" is NOT a usable post-shipment trigger, and
// Order.status lags real carrier state (often indefinitely: DELHIVERY_WEBHOOK_
// SECRET is unset, so Shipment.status is stale from the same cause). The gate:
//
//   1. Order.status SHIPPED                         → BLOCK   (unchanged fast-path)
//   2. no Shipment row                              → ALLOW   (nothing dispatched)
//   3. Shipment.status past pickup                  → BLOCK   (local, no fetch)
//   4. Shipment older than carrierStaleDays         → BLOCK   (backstop, no fetch)
//   5. Shipment.status PENDING/MANIFESTED, fresh    → NEEDS_CARRIER_CHECK
//
// For (5) the caller runs classifyCarrierTier() once and feeds the result to
// resolveDealerGateFromCarrier(). Fail closed everywhere: FETCH_FAILED blocks.

export type ShipmentStatusValue =
  | "PENDING"
  | "MANIFESTED"
  | "PICKED_UP"
  | "IN_TRANSIT"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "FAILED_DELIVERY"
  | "RETURNED"
  | "CANCELLED";

export type DealerGateDecision = "ALLOW" | "BLOCK" | "NEEDS_CARRIER_CHECK";

export interface DealerGateShipmentFacts {
  status: ShipmentStatusValue;
  /** Whole or fractional days since the Shipment row was created. */
  ageDays: number;
}

/**
 * Pure, no I/O. Decides as far as local data allows; returns
 * NEEDS_CARRIER_CHECK when only a live carrier fetch can settle it.
 */
export function evaluateDealerGateLocal(params: {
  orderStatus: OrderStatusForCancellation;
  shipment: DealerGateShipmentFacts | null;
  carrierStaleDays: number;
}): DealerGateDecision {
  const { orderStatus, shipment, carrierStaleDays } = params;

  if (orderStatus === "SHIPPED") return "BLOCK";
  if (!shipment) return "ALLOW";

  if (POST_PICKUP_SHIPMENT_STATUSES.has(shipment.status)) return "BLOCK";
  if (shipment.ageDays > carrierStaleDays) return "BLOCK";

  if (shipment.status === "PENDING" || shipment.status === "MANIFESTED") {
    return "NEEDS_CARRIER_CHECK";
  }

  // Any status not covered above — fail closed.
  return "BLOCK";
}

/** Pure. Turns a carrier classification into the final dealer decision. */
export function resolveDealerGateFromCarrier(tier: CarrierTier): "ALLOW" | "BLOCK" {
  return tier === "PRE_SHIP" ? "ALLOW" : "BLOCK";
}

// ─── Admin tier defaulting from carrier data (F-02) ───────────────────────────

/**
 * Pure. The admin cancellation tier is defaulted from RAW carrier data, never
 * from Order.status. FETCH_FAILED / no-shipment fall back to the passed
 * `orderStatusStage` (evaluateCancellation's Order.status-derived stage) only
 * when there is genuinely nothing better — and FETCH_FAILED with a shipment
 * present defaults to POST_SHIP (fail closed).
 */
export function defaultAdminStageFromCarrier(params: {
  hasShipment: boolean;
  carrierTier: CarrierTier | null;
  orderStatusStage: CancellationStage;
}): CancellationStage {
  const { hasShipment, carrierTier, orderStatusStage } = params;
  if (!hasShipment || carrierTier === null) return orderStatusStage;
  if (carrierTier === "PRE_SHIP") return "PRE_SHIP";
  return "POST_SHIP"; // POST_SHIP or FETCH_FAILED
}
