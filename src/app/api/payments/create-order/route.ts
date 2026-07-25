import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, badRequest, unauthorized, forbidden, notFound, serverError } from "@/lib/api";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { paymentDebug } from "@/lib/payment-debug"; // TODO(remove-before-prod)
import Razorpay from "razorpay";

// Same flag the checkout page uses to hide the Full Payment/20% Advance
// options — checked here too since the frontend hiding a button is not an
// authorization control. Razorpay isn't configured on the merchant account
// yet; this must reject even if someone calls the endpoint directly.
const RAZORPAY_ENABLED = process.env.NEXT_PUBLIC_RAZORPAY_ENABLED === "true";

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
  if (!RAZORPAY_ENABLED) {
    return badRequest("Online payment is not available right now. Please use Direct UPI or Cash on Delivery.", "RAZORPAY_DISABLED");
  }

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

  paymentDebug("create-order: request received", { orderId, userId }); // TODO(remove-before-prod)

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
    paymentDebug("create-order: creating Razorpay order", { orderId, amountInPaise, paymentType: order.paymentType }); // TODO(remove-before-prod)

    const razorpayOrder = await getRazorpay().orders.create({
      amount: amountInPaise,
      currency: "INR",
      receipt: order.orderNumber,
      notes: {
        orderId: order.id,
        dealerId: dealer.id,
      },
    });

    paymentDebug("create-order: Razorpay order created", { orderId, razorpayOrderId: razorpayOrder.id }); // TODO(remove-before-prod)

    await prisma.payment.create({
      data: {
        orderId: order.id,
        razorpayOrderId: razorpayOrder.id,
        amount: order.amountDue,
        paymentType: order.paymentType,
        status: "PENDING",
      },
    });

    paymentDebug("create-order: PENDING Payment row created, returning to client", { orderId, razorpayOrderId: razorpayOrder.id }); // TODO(remove-before-prod)

    return ok({
      razorpayOrderId: razorpayOrder.id,
      amount: amountInPaise,
      currency: "INR",
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      orderNumber: order.orderNumber,
    });
  } catch (err) {
    paymentDebug("create-order: FAILED", { orderId, error: err instanceof Error ? err.message : String(err) }); // TODO(remove-before-prod)
    return serverError(err, "create-razorpay-order", { orderId });
  }
}
