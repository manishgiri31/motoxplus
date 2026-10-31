import { roundToPaise } from "@/lib/utils";

/**
 * Order money fields right after the payment for an order is captured/verified.
 *
 * Before payment, Order.amountDue is what the buyer owes NOW (the 20% advance
 * for ADVANCE_20, the whole total for FULL_100). Afterwards it must become what
 * is still owed ON DELIVERY, because createDelhiveryShipment derives COD vs
 * Prepaid and cod_amount straight from it:
 *   FULL_100   -> amountDue 0               -> Prepaid, collect nothing
 *   ADVANCE_20 -> amountDue grandTotal - advance -> COD, collect the balance
 *
 * Single source for both finalization paths (Razorpay: payments/finalize.ts,
 * manual UPI: admin/payments/[id]/verify) — the UPI route used to hardcode
 * amountDue 0, so every advance order shipped Prepaid.
 */
export function balancesAfterPayment(order: {
  paymentType: string;
  grandTotal: number;
  amountDue: number;
}): { amountPaid: number; amountDue: number; paymentStatus: "PAID" | "PARTIAL" } {
  const isFullPayment = order.paymentType === "FULL_100";
  return {
    amountPaid: order.amountDue,
    amountDue: isFullPayment ? 0 : roundToPaise(Math.max(0, order.grandTotal - order.amountDue)),
    paymentStatus: isFullPayment ? "PAID" : "PARTIAL",
  };
}
