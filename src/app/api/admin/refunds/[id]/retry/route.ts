import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { refundPayment } from "@/lib/razorpay";

const ALLOWED_ROLES = ["ADMIN", "SUPER_ADMIN", "ACCOUNTS"];

/** Re-drives a FAILED refund using the amounts already stored on the
 *  OrderCancellation row — never recomputes the charge, since the order's
 *  status has already moved to CANCELLED by the time this runs. */
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session || !ALLOWED_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cancellation = await prisma.orderCancellation.findUnique({
    where: { id: params.id },
    include: { order: { include: { payments: { orderBy: { createdAt: "desc" } } } } },
  });
  if (!cancellation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (cancellation.refundStatus !== "FAILED") {
    return NextResponse.json({ error: "Only failed refunds can be retried" }, { status: 400 });
  }
  if (cancellation.refundAmount <= 0) {
    return NextResponse.json({ error: "This cancellation has nothing to refund" }, { status: 400 });
  }

  const paidPayment = cancellation.order.payments.find((p) => p.status === "PAID" && p.razorpayPaymentId);
  if (!paidPayment?.razorpayPaymentId) {
    return NextResponse.json(
      { error: "No Razorpay-captured payment found for this order — refund manually" },
      { status: 422 }
    );
  }

  // F-07: atomically claim this retry (FAILED → INITIATED) BEFORE calling
  // Razorpay. refundPayment has no idempotency key, so two concurrent retries
  // (double-click, two admins) would otherwise both pass the read-then-check
  // above and both issue a refund. updateMany-with-guard is the same
  // concurrency pattern the cancel/payment paths use.
  const claimed = await prisma.orderCancellation.updateMany({
    where: { id: cancellation.id, refundStatus: "FAILED" },
    data: { refundStatus: "INITIATED", refundError: null },
  });
  if (claimed.count === 0) {
    return NextResponse.json(
      { error: "This refund is already being processed or has completed" },
      { status: 409 }
    );
  }

  try {
    const result = await refundPayment(paidPayment.razorpayPaymentId, Math.round(cancellation.refundAmount * 100), {
      orderId: cancellation.orderId,
      orderNumber: cancellation.order.orderNumber,
      retriedBy: session.user.id,
    });
    const updated = await prisma.orderCancellation.update({
      where: { id: cancellation.id },
      data: { refundStatus: "INITIATED", refundId: result.refundId, refundError: null },
    });
    return NextResponse.json(updated);
  } catch (err) {
    console.error(`[Refund Retry] Failed for cancellation ${cancellation.id}:`, err);
    const message = err instanceof Error ? err.message : "Refund retry failed";
    // Release the claim so a later retry can pick it up again.
    await prisma.orderCancellation.update({
      where: { id: cancellation.id },
      data: { refundStatus: "FAILED", refundError: message },
    });
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
