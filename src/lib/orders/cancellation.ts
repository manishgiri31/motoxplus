import { roundToPaise } from "@/lib/utils";

/**
 * Stage-based cancellation fee: the later a dealer cancels, the more it
 * costs them. Fee is a percentage of amountPaid (money actually captured —
 * correct for ADVANCE_20 orders where the balance was never collected).
 * COD orders have amountPaid = 0, so pre-shipping COD cancellations
 * naturally cost ₹0 with no special-casing beyond the post-shipping block.
 *
 * This is the single source of truth for fee numbers — the quote endpoint,
 * the cancel endpoint, and the tests all call it. The client never
 * computes a fee; the server always recalculates from the order's current
 * status at the moment of cancellation.
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

export type CancellationBlockCode =
  | "ALREADY_CANCELLED"
  | "DELIVERED"
  | "RETURNED"
  | "COD_AFTER_SHIPPING";

export type CancellationEligibility =
  | { ok: true; feePercent: number }
  | { ok: false; code: CancellationBlockCode; message: string };

const RETURN_FLOW_HINT =
  "This order can no longer be cancelled. Please use the return/refund flow instead.";

/**
 * Fee tiers as data, not branches — SHIPPED is 20% for prepaid orders only;
 * COD orders never reach SHIPPED in this table because they're blocked
 * before the percent lookup (see evaluateCancellation).
 */
const FEE_TIERS: Partial<Record<OrderStatusForCancellation, number>> = {
  PENDING: 0,
  CONFIRMED: 2,
  PROCESSING: 2,
  SHIPPED: 20,
};

export function evaluateCancellation(params: {
  status: OrderStatusForCancellation;
  paymentType: PaymentTypeForCancellation;
}): CancellationEligibility {
  const { status, paymentType } = params;

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
    return {
      ok: false,
      code: "COD_AFTER_SHIPPING",
      message: "Cash on Delivery orders cannot be cancelled once shipped. Please refuse delivery or use the return/refund flow instead.",
    };
  }

  const feePercent = FEE_TIERS[status];
  if (feePercent === undefined) {
    // Any OrderStatus not covered above (defensive — the enum is closed,
    // but a future added status should fail closed, not silently allow).
    return { ok: false, code: "RETURNED", message: RETURN_FLOW_HINT };
  }

  return { ok: true, feePercent };
}

export interface CancellationQuote {
  feePercent: number;
  feeAmount: number;
  refundAmount: number;
}

export function calculateCancellation(params: {
  feePercent: number;
  amountPaid: number;
}): CancellationQuote {
  const feeAmount = roundToPaise((params.amountPaid * params.feePercent) / 100);
  const refundAmount = roundToPaise(params.amountPaid - feeAmount);
  return { feePercent: params.feePercent, feeAmount, refundAmount };
}

export const CANCELLABLE_STATUSES: OrderStatusForCancellation[] = ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED"];
