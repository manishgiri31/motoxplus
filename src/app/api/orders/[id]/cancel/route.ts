import { NextRequest, NextResponse } from "next/server";
import type { CancelReasonCode } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { refundPayment } from "@/lib/razorpay";
import { restockItems } from "@/lib/orders/stock";
import {
  evaluateCancellation,
  calculateCancellation,
  type CancellationStage,
  type OrderStatusForCancellation,
  type PaymentTypeForCancellation,
} from "@/lib/orders/cancellation";
import { getCancellationPolicy } from "@/lib/orders/cancellation-policy";
import { enforceRateLimit, rejectOversizedBody } from "@/lib/auth/rate-limit-budgets";

const WAIVE_ROLES = ["SUPER_ADMIN", "ACCOUNTS"];
const CANCEL_ROLES = ["ADMIN", "SUPER_ADMIN", "ACCOUNTS"];
const REASON_CODES: CancelReasonCode[] = ["CHANGED_MIND", "ORDERED_BY_MISTAKE", "FOUND_BETTER_PRICE", "DELIVERY_TOO_SLOW", "OTHER"];

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
}

async function buildPreviewPayload(orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return null;
  const policy = await getCancellationPolicy();
  const eligibility = evaluateCancellation({
    status: order.status as OrderStatusForCancellation,
    paymentType: order.paymentType as PaymentTypeForCancellation,
    policy,
  });
  if (!eligibility.ok) {
    return { allowed: false as const, grandTotal: order.grandTotal, amountPaid: order.amountPaid, reason: eligibility.message };
  }
  const quote = calculateCancellation({ feePercent: eligibility.feePercent, amountPaid: order.amountPaid });
  return {
    allowed: true as const,
    stage: eligibility.stage,
    chargePercent: quote.feePercent,
    chargeAmount: quote.feeAmount,
    grandTotal: order.grandTotal,
    amountPaid: order.amountPaid,
    refundAmount: quote.refundAmount,
    waived: quote.waived,
  };
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

  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: { items: true, payments: true },
  });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  if (isDealerActor) {
    const dealer = await prisma.dealer.findUnique({ where: { userId } });
    if (!dealer || order.dealerId !== dealer.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const policy = await getCancellationPolicy();
  const eligibility = evaluateCancellation({
    status: order.status as OrderStatusForCancellation,
    paymentType: order.paymentType as PaymentTypeForCancellation,
    policy,
  });

  if (!eligibility.ok) {
    return NextResponse.json({ allowed: false, reason: eligibility.message }, { status: 422 });
  }

  // Order moved stage between the dealer/admin's preview and this confirm —
  // reject and hand back fresh numbers rather than charging a fee they never saw.
  if (body.expectedStage && body.expectedStage !== eligibility.stage) {
    const preview = await buildPreviewPayload(order.id);
    return NextResponse.json({ error: "Order status changed", preview }, { status: 409 });
  }

  const quote = calculateCancellation({ feePercent: eligibility.feePercent, amountPaid: order.amountPaid });
  const feeAmount = wantsWaive ? 0 : quote.feeAmount;
  const refundAmount = wantsWaive ? order.amountPaid : quote.refundAmount;

  try {
    await prisma.$transaction(async (tx) => {
      // Guarded update: only proceeds if status is still what we just
      // evaluated against. Mirrors decrementStock's updateMany-guard pattern
      // in lib/orders/stock.ts — count 0 means someone else changed the order
      // between our read and this write (a true concurrent-request race,
      // distinct from the expectedStage check above which catches the
      // preview-vs-confirm gap). Runs inside this transaction, not before it,
      // so a status flip can't happen between the guard and the writes below.
      const guarded = await tx.order.updateMany({
        where: { id: order.id, status: order.status },
        data: { status: "CANCELLED", amountDue: 0, stockReserved: false },
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
          feePercent: eligibility.feePercent,
          feeAmount,
          amountPaidAtCancellation: order.amountPaid,
          refundAmount,
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
    });
  } catch (err) {
    if (err instanceof OrderChangedError) {
      const preview = await buildPreviewPayload(order.id);
      return NextResponse.json({ error: "Order status changed", preview }, { status: 409 });
    }
    throw err;
  }

  // Refund happens outside the transaction — it's an external call to Razorpay,
  // and a slow/hung request there shouldn't hold the DB transaction open.
  // If it throws, the cancellation itself has already committed (correct: the
  // order IS cancelled) but refundStatus stays INITIATED with no refundId,
  // which the admin refund-ops "Retry refund" action picks up and re-drives.
  if (refundAmount > 0) {
    const paidPayment = order.payments
      .filter((p) => p.status === "PAID" && p.razorpayPaymentId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];

    if (!paidPayment?.razorpayPaymentId) {
      // No Razorpay-captured payment to refund against (e.g. balance paid via
      // UPI proof submission, not Razorpay) — flag for manual handling rather
      // than silently leaving refundStatus stuck at INITIATED forever.
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
  return NextResponse.json({
    success: true,
    stage: eligibility.stage,
    chargePercent: eligibility.feePercent,
    chargeAmount: feeAmount,
    refundAmount,
    refundStatus: cancellation?.refundStatus,
    waived: wantsWaive,
  });
}
