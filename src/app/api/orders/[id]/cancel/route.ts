import { NextRequest, NextResponse } from "next/server";
import type { CancelReasonCode } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { refundPayment } from "@/lib/razorpay";
import { restockItems } from "@/lib/orders/stock";
import { cancelDelhiveryShipment } from "@/lib/delhivery";
import { classifyCarrierTier } from "@/lib/delhivery/carrier-cancellation";
import {
  evaluateCancellation,
  calculateCancellation,
  defaultAdminStageFromCarrier,
  type CancellationStage,
  type OrderStatusForCancellation,
  type PaymentTypeForCancellation,
} from "@/lib/orders/cancellation";
import { getCancellationPolicy } from "@/lib/orders/cancellation-policy";
import { resolveDealerGate, buildCancellationQuote, type GateOrder } from "@/lib/orders/cancellation-gate";
import { enforceRateLimit, rejectOversizedBody } from "@/lib/auth/rate-limit-budgets";
import { notifyOrderEvent } from "@/lib/push/order-notifications";
import { computeFullCancelWithRefund } from "@/lib/schemes/adjustment";

const WAIVE_ROLES = ["SUPER_ADMIN", "ACCOUNTS"];
const CANCEL_ROLES = ["ADMIN", "SUPER_ADMIN", "ACCOUNTS"];
const REASON_CODES: CancelReasonCode[] = ["CHANGED_MIND", "ORDERED_BY_MISTAKE", "FOUND_BETTER_PRICE", "DELIVERY_TOO_SLOW", "OTHER"];

const MSG_CARRIER_CANCEL_FAILED =
  "We couldn't cancel the courier shipment for this order, so nothing was changed. Please contact support.";

/** Thrown inside the transaction when the guarded status update matches zero
 *  rows (order changed between our read and this write) — caught outside to
 *  return 409 with fresh numbers, same shape as the expectedStage check. */
class OrderChangedError extends Error {}

interface CancelBody {
  reason?: string;
  reasonCode?: string;
  /** Stage the client displayed in its confirmation dialog (from the preview
   *  call). Mismatch against the freshly-computed stage means the order moved
   *  between preview and confirm — reject with 409 rather than silently
   *  charging a different fee than what the dealer/admin agreed to. */
  expectedStage?: CancellationStage;
  /** SUPER_ADMIN/ACCOUNTS only — silently ignored for any other role. */
  waive?: boolean;
  /** Admin (CANCEL_ROLES) only. Overrides the carrier-defaulted fee tier;
   *  any deviation from the defaulted tier is logged to OrderEvent. */
  tierOverride?: CancellationStage;
}

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const oversized = rejectOversizedBody(req, 4 * 1024);
  if (oversized) return oversized;

  const params = await props.params;
  const userId = await getCurrentUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const authUser = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const isDealerActor = authUser.role === "DEALER";
  if (!isDealerActor && !CANCEL_ROLES.includes(authUser.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const limited = await enforceRateLimit(req, "ORDER_CANCEL", userId);
  if (limited) return limited;

  const body = (await req.json().catch(() => ({}))) as CancelBody;
  const reasonCode: CancelReasonCode = REASON_CODES.includes(body.reasonCode as CancelReasonCode)
    ? (body.reasonCode as CancelReasonCode)
    : "OTHER";
  const reason = body.reason?.slice(0, 500);
  const wantsWaive = body.waive === true && WAIVE_ROLES.includes(authUser.role);
  const tierOverride: CancellationStage | undefined =
    !isDealerActor && (body.tierOverride === "PRE_SHIP" || body.tierOverride === "POST_SHIP")
      ? body.tierOverride
      : undefined;

  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: {
      items: true,
      payments: true,
      shipment: { select: { waybill: true, status: true, createdAt: true } },
      schemeRedemption: true,
    },
  });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  if (isDealerActor) {
    const dealer = await prisma.dealer.findUnique({ where: { userId } });
    if (!dealer || order.dealerId !== dealer.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const gateOrder: GateOrder = {
    id: order.id,
    status: order.status,
    paymentType: order.paymentType,
    grandTotal: order.grandTotal,
    amountPaid: order.amountPaid,
    shipment: order.shipment,
    schemeRedemption: order.schemeRedemption ? { itemsValue: order.schemeRedemption.itemsValue } : null,
  };

  // Carrier-aware dealer gate (F-02 / F-04). Replaces the Order.status-only
  // isDealerPostShipBlocked stopgap.
  if (isDealerActor) {
    const blocked = await resolveDealerGate(gateOrder);
    if (blocked) {
      return NextResponse.json({ error: blocked.reason, allowed: false, reason: blocked.reason }, { status: 422 });
    }
  }

  const policy = await getCancellationPolicy();
  const eligibility = evaluateCancellation({
    status: order.status as OrderStatusForCancellation,
    paymentType: order.paymentType as PaymentTypeForCancellation,
    policy,
  });
  if (!eligibility.ok) {
    return NextResponse.json({ error: eligibility.message, allowed: false, reason: eligibility.message }, { status: 422 });
  }

  // Effective fee tier. Dealer: always PRE_SHIP (the gate guarantees Order.status
  // is pre-shipment when a dealer is let through). Admin: defaulted from RAW
  // carrier data (never Order.status), overridable, override audited.
  let effectiveStage: CancellationStage = eligibility.stage;
  let defaultedStage: CancellationStage = eligibility.stage;
  let carrierStatusForLog = "";
  if (!isDealerActor && order.shipment) {
    const classification = await classifyCarrierTier(order.shipment.waybill);
    defaultedStage = defaultAdminStageFromCarrier({
      hasShipment: true,
      carrierTier: classification.tier,
      orderStatusStage: eligibility.stage,
    });
    carrierStatusForLog = `${classification.rawStatusText || "?"} / ${classification.rawStatusCode || "?"} (${classification.tier})`;
    effectiveStage = tierOverride ?? defaultedStage;
  }

  const effectiveFeePercent =
    effectiveStage === "PRE_SHIP" ? policy.preShipChargePercent : policy.postShipChargePercent;

  // Order moved stage between preview and confirm — reject with fresh numbers
  // rather than charging a fee they never saw.
  if (body.expectedStage && body.expectedStage !== effectiveStage) {
    const preview = await buildCancellationQuote(gateOrder, isDealerActor);
    return NextResponse.json({ error: "Order status changed", preview }, { status: 409 });
  }

  const quote = calculateCancellation({ feePercent: effectiveFeePercent, amountPaid: order.amountPaid });
  const feeAmount = wantsWaive ? 0 : quote.feeAmount;
  const refundBeforeSchemeAdjustment = wantsWaive ? order.amountPaid : quote.refundAmount;

  // Scheme Adjustment is always its own line, deducted ON TOP of the
  // cancellation fee above — never combined with it, and never skipped by a
  // fee waive (waiving is about the cancellation fee, not the GST Benefit
  // goods the dealer already has). See lib/schemes/adjustment.ts and the
  // OrderCancellation.schemeAdjustmentAmount doc comment.
  let schemeAdjustmentAmount = 0;
  let uncollectedSchemeShortfall = 0;
  let schemeRedemptionStatus: "CANCELLED" | "ADJUSTED" | null = null;
  let refundAmount = refundBeforeSchemeAdjustment;
  if (order.schemeRedemption) {
    // effectiveStage is already this route's own signal for "has this order
    // progressed past dispatch" (it's what sets the 2%/20% fee tier) — reused
    // here rather than introducing a second, possibly-disagreeing notion of
    // "dispatched".
    const result = computeFullCancelWithRefund({
      itemsValue: order.schemeRedemption.itemsValue,
      dispatched: effectiveStage === "POST_SHIP",
      refundBeforeAdjustment: refundBeforeSchemeAdjustment,
    });
    schemeAdjustmentAmount = result.adjustmentApplied;
    uncollectedSchemeShortfall = result.uncollectedShortfall;
    schemeRedemptionStatus = result.redemptionStatus;
    refundAmount = result.refundAfterAdjustment;
  }

  // ── Cancel the real Delhivery parcel FIRST (F-04) ──────────────────────────
  // Delhivery before money (docs/delhivery-open-items.md item 1). If the carrier
  // won't accept the cancellation, mutate NOTHING — no CANCELLED, no
  // OrderCancellation, no refund. cancelDelhiveryShipment is idempotent and safe
  // to retry, so a later manual retry is fine.
  if (order.shipment) {
    let accepted = false;
    try {
      const res = await cancelDelhiveryShipment(order.shipment.waybill);
      accepted = res.accepted === true;
    } catch (err) {
      console.error(`[Cancel] Delhivery cancel threw for order ${order.id}:`, err);
    }
    if (!accepted) {
      return NextResponse.json(
        { error: MSG_CARRIER_CANCEL_FAILED, code: "CARRIER_CANCEL_FAILED" },
        { status: 422 }
      );
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Guarded update: only proceeds if status is still what we evaluated
      // against — count 0 means a concurrent request changed the order.
      const guarded = await tx.order.updateMany({
        where: { id: order.id, status: order.status },
        data: { status: "CANCELLED", amountDue: 0, stockReserved: false, schemeAdjustmentAmount },
      });
      if (guarded.count === 0) throw new OrderChangedError();

      if (order.stockReserved) {
        await restockItems(
          tx,
          order.items.map((item) => ({ productId: item.productId, variantId: item.variantId, quantity: item.quantity }))
        );
      }

      await tx.orderCancellation.create({
        data: {
          orderId: order.id,
          fromStatus: order.status,
          feePercent: effectiveFeePercent,
          feeAmount,
          amountPaidAtCancellation: order.amountPaid,
          refundAmount,
          schemeAdjustmentAmount,
          reasonCode,
          reason,
          cancelledByUserId: userId,
          cancelledByRole: isDealerActor ? "DEALER" : "ADMIN",
          refundStatus: refundAmount > 0 ? "INITIATED" : "NOT_APPLICABLE",
          waived: wantsWaive,
          waivedByUserId: wantsWaive ? userId : null,
          waivedAt: wantsWaive ? new Date() : null,
        },
      });

      if (schemeRedemptionStatus) {
        await tx.schemeRedemption.update({
          where: { orderId: order.id },
          data: { status: schemeRedemptionStatus },
        });
      }

      // The refund pool couldn't cover the full clawback — the shortfall
      // follows the dealer to their next order (Dealer.outstandingDues)
      // rather than being written off (see DealerDuesEntry doc comment: the
      // scheme goods already left the warehouse, forgiving the gap would
      // make "order big, take the goods, pay a small advance, cancel" free).
      if (uncollectedSchemeShortfall > 0) {
        const updatedDealer = await tx.dealer.update({
          where: { id: order.dealerId },
          data: { outstandingDues: { increment: uncollectedSchemeShortfall } },
          select: { outstandingDues: true },
        });
        await tx.dealerDuesEntry.create({
          data: {
            dealerId: order.dealerId,
            amount: uncollectedSchemeShortfall,
            balanceAfter: updatedDealer.outstandingDues,
            reason: "SCHEME_SHORTFALL",
            orderId: order.id,
            note: `Uncollected GST Benefit clawback on cancellation of order ${order.orderNumber} — refund pool insufficient.`,
            createdByRole: "SYSTEM",
          },
        });
      }

      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          type: "CANCELLED",
          fromStatus: order.status,
          toStatus: "CANCELLED",
          actorId: userId,
          actorRole: authUser.role,
          reason,
        },
      });

      if (tierOverride && tierOverride !== defaultedStage) {
        await tx.orderEvent.create({
          data: {
            orderId: order.id,
            type: "CANCELLATION_TIER_OVERRIDE",
            actorId: userId,
            actorRole: authUser.role,
            reason: `carrier: ${carrierStatusForLog}; defaulted: ${defaultedStage}; chosen: ${tierOverride}`,
          },
        });
      }
    });
  } catch (err) {
    if (err instanceof OrderChangedError) {
      const preview = await buildCancellationQuote(gateOrder, isDealerActor);
      return NextResponse.json({ error: "Order status changed", preview }, { status: 409 });
    }
    throw err;
  }

  // Refund happens outside the transaction — external call to Razorpay. If it
  // throws, the cancellation has already committed (correct: the order IS
  // cancelled) but refundStatus stays INITIATED with no refundId, which the
  // admin "Retry refund" action picks up and re-drives.
  if (refundAmount > 0) {
    const paidPayment = order.payments
      .filter((p) => p.status === "PAID" && p.razorpayPaymentId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];

    if (!paidPayment?.razorpayPaymentId) {
      await prisma.orderCancellation.update({
        where: { orderId: order.id },
        data: { refundStatus: "FAILED", refundError: "No Razorpay-captured payment found for this order" },
      });
    } else {
      try {
        const result = await refundPayment(paidPayment.razorpayPaymentId, Math.round(refundAmount * 100), {
          orderId: order.id,
          orderNumber: order.orderNumber,
          reason: reasonCode,
        });
        await prisma.orderCancellation.update({
          where: { orderId: order.id },
          data: { refundId: result.refundId },
        });
      } catch (err) {
        console.error(`[Cancel] Razorpay refund failed for order ${order.id}:`, err);
        await prisma.orderCancellation.update({
          where: { orderId: order.id },
          data: {
            refundStatus: "FAILED",
            refundError: err instanceof Error ? err.message : "Refund request failed",
          },
        });
      }
    }
  }

  const cancellation = await prisma.orderCancellation.findUnique({ where: { orderId: order.id } });

  // Notify the dealer's devices — notifyOrderEvent re-reads the cancellation
  // so the push carries the current refund status (fire-and-forget; the
  // refund.processed webhook won't re-notify because of the dedupe marker).
  void notifyOrderEvent(order.id, "ORDER_CANCELLED");

  return NextResponse.json({
    success: true,
    stage: effectiveStage,
    chargePercent: effectiveFeePercent,
    chargeAmount: feeAmount,
    schemeAdjustmentAmount,
    uncollectedSchemeShortfall,
    refundAmount,
    refundStatus: cancellation?.refundStatus,
    waived: wantsWaive,
  });
}
