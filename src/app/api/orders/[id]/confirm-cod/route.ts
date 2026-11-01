import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { resolveOrderActor, ACCOUNT_NOT_VERIFIED_MESSAGE } from "@/lib/auth/verified-account";
import { confirmCodOrder, isCodAvailable, COD_UNAVAILABLE_MESSAGE } from "@/lib/orders/cod";
import { InsufficientStockError } from "@/lib/orders/stock";

/**
 * Switch a still-unpaid B2C order to Cash on Delivery — used by the checkout's
 * "payment cancelled" screen after the customer dismissed Razorpay. Ownership
 * and eligibility are re-checked here; the client's view of the order is not
 * trusted.
 */
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const userId = await getCurrentUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [order, actor] = await Promise.all([
    prisma.order.findUnique({ where: { id: params.id }, include: { payments: { select: { status: true } } } }),
    resolveOrderActor(userId),
  ]);
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (!actor) return NextResponse.json({ error: ACCOUNT_NOT_VERIFIED_MESSAGE }, { status: 403 });
  if (actor.channel !== "B2C" || order.customerId !== actor.customer.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Already confirmed (double click / retry) — nothing to do.
  if (order.paymentType === "COD" && order.status === "CONFIRMED") {
    return NextResponse.json({ success: true, orderId: order.id });
  }
  if (order.status !== "PENDING" || order.stockReserved || order.payments.some((p) => p.status === "PAID")) {
    return NextResponse.json({ error: "This order can no longer be switched to Cash on Delivery." }, { status: 409 });
  }
  if (!order.deliveryPincode || !(await isCodAvailable(order.deliveryPincode))) {
    return NextResponse.json({ error: COD_UNAVAILABLE_MESSAGE, code: "COD_UNAVAILABLE" }, { status: 400 });
  }

  try {
    await confirmCodOrder(order.id);
  } catch (err) {
    if (err instanceof InsufficientStockError) {
      return NextResponse.json(
        { error: "Some items just went out of stock, so this order can't be confirmed. Please contact support." },
        { status: 409 }
      );
    }
    console.error(`[Orders] confirm-cod failed for order ${order.id}:`, err);
    return NextResponse.json({ error: "Could not confirm Cash on Delivery. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ success: true, orderId: order.id });
}
