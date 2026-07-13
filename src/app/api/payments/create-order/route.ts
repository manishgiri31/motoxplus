import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, badRequest, unauthorized, forbidden, notFound, serverError } from "@/lib/api";
import { getCurrentUserId } from "@/lib/auth/current-user";
import Razorpay from "razorpay";

// Singleton — avoid re-creating client on every request
let _razorpay: Razorpay | null = null;
function getRazorpay(): Razorpay {
  if (!_razorpay) {
    const key_id = process.env.RAZORPAY_KEY_ID;
    const key_secret = process.env.RAZORPAY_KEY_SECRET;
    if (!key_id || !key_secret) {
      throw new Error("Razorpay credentials not configured");
    }
    _razorpay = new Razorpay({ key_id, key_secret });
  }
  return _razorpay;
}

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId(req);
  if (!userId) {
    return unauthorized();
  }
  const authUser = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!authUser || authUser.role !== "DEALER") {
    return unauthorized();
  }

  let body: { orderId?: string };
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const { orderId } = body;
  if (!orderId || typeof orderId !== "string") {
    return badRequest("orderId is required");
  }

  try {
    const [order, dealer] = await Promise.all([
      prisma.order.findUnique({ where: { id: orderId } }),
      prisma.dealer.findUnique({ where: { userId } }),
    ]);

    if (!order) return notFound("Order");
    if (!dealer || order.dealerId !== dealer.id) return forbidden();

    if (order.amountDue <= 0) {
      return badRequest("No payment due on this order");
    }

    const amountInPaise = Math.round(order.amountDue * 100);

    const razorpayOrder = await getRazorpay().orders.create({
      amount: amountInPaise,
      currency: "INR",
      receipt: order.orderNumber,
      notes: {
        orderId: order.id,
        dealerId: dealer.id,
      },
    });

    await prisma.payment.create({
      data: {
        orderId: order.id,
        razorpayOrderId: razorpayOrder.id,
        amount: order.amountDue,
        paymentType: order.paymentType,
        status: "PENDING",
      },
    });

    return ok({
      razorpayOrderId: razorpayOrder.id,
      amount: amountInPaise,
      currency: "INR",
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      orderNumber: order.orderNumber,
    });
  } catch (err) {
    return serverError(err, "create-razorpay-order", { orderId });
  }
}
