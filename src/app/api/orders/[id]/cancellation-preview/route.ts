import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth/current-user";
import {
  evaluateCancellation,
  calculateCancellation,
  type OrderStatusForCancellation,
  type PaymentTypeForCancellation,
} from "@/lib/orders/cancellation";
import { getCancellationPolicy } from "@/lib/orders/cancellation-policy";

/**
 * Read-only quote — the single source of truth the UI displays before a dealer
 * or admin confirms. POST .../cancel recomputes independently at execution
 * time rather than trusting anything from this response back, since order
 * status can change between preview and confirm.
 */
export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const userId = await getCurrentUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const authUser = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const order = await prisma.order.findUnique({ where: { id: params.id } });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  if (authUser.role === "DEALER") {
    const dealer = await prisma.dealer.findUnique({ where: { userId } });
    if (!dealer || order.dealerId !== dealer.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else if (!["ADMIN", "SUPER_ADMIN", "ACCOUNTS"].includes(authUser.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const policy = await getCancellationPolicy();
  const eligibility = evaluateCancellation({
    status: order.status as OrderStatusForCancellation,
    paymentType: order.paymentType as PaymentTypeForCancellation,
    policy,
  });

  if (!eligibility.ok) {
    return NextResponse.json({
      allowed: false,
      grandTotal: order.grandTotal,
      amountPaid: order.amountPaid,
      reason: eligibility.message,
    });
  }

  const quote = calculateCancellation({ feePercent: eligibility.feePercent, amountPaid: order.amountPaid });

  return NextResponse.json({
    allowed: true,
    stage: eligibility.stage,
    chargePercent: quote.feePercent,
    chargeAmount: quote.feeAmount,
    grandTotal: order.grandTotal,
    amountPaid: order.amountPaid,
    refundAmount: quote.refundAmount,
    waived: quote.waived,
  });
}
