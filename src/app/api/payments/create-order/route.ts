import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, badRequest, unauthorized, forbidden, notFound, serverError } from "@/lib/api";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { resolveOrderActor, ACCOUNT_NOT_VERIFIED_MESSAGE } from "@/lib/auth/verified-account";
import { getRazorpay } from "@/lib/razorpay";

// Same flag the checkout page uses to hide the Full Payment/20% Advance
// options — checked here too since the frontend hiding a button is not an
// authorization control. Razorpay isn't configured on the merchant account
// yet; this must reject even if someone calls the endpoint directly.
const RAZORPAY_ENABLED = process.env.NEXT_PUBLIC_RAZORPAY_ENABLED === "true";

export async function POST(req: NextRequest) {
  if (!RAZORPAY_ENABLED) {
    return badRequest("Online payment is not available right now. Please use Direct UPI or Cash on Delivery.", "RAZORPAY_DISABLED");
  }

  const userId = await getCurrentUserId(req);
  if (!userId) {
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
    const [order, actor] = await Promise.all([
      prisma.order.findUnique({ where: { id: orderId } }),
      resolveOrderActor(userId),
    ]);

    if (!order) return notFound("Order");
    if (!actor) return forbidden(ACCOUNT_NOT_VERIFIED_MESSAGE);
    const ownerId = actor.channel === "B2C" ? actor.customer.id : actor.dealer.id;
    const orderOwnerId = actor.channel === "B2C" ? order.customerId : order.dealerId;
    if (orderOwnerId !== ownerId) return forbidden();

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
        ...(actor.channel === "B2C" ? { customerId: actor.customer.id } : { dealerId: actor.dealer.id }),
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
