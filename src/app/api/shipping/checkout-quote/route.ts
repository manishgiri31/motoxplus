import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { resolveOrderActor, ACCOUNT_NOT_VERIFIED_MESSAGE } from "@/lib/auth/verified-account";
import { enforceRateLimit, rejectOversizedBody } from "@/lib/auth/rate-limit-budgets";
import { priceB2CCart, quoteB2CShipping } from "@/lib/shipping/b2c-checkout";

/**
 * POST /api/shipping/checkout-quote — the B2C checkout page's order summary.
 *
 * Body: { deliveryPincode: "135001", paymentMode?: "Prepaid" | "COD" }
 * The cart is the signed-in customer's own cart, read here — never prices sent by the browser.
 *
 * Returns { orderTotal, shippingCost, grandTotal, freeDelivery, source } computed by exactly the same
 * functions POST /api/orders charges with (lib/shipping/b2c-checkout.ts). Errors use the same status, `code`
 * and message the order route would return, so the page can stop the customer before they submit.
 */
export async function POST(req: NextRequest) {
  const oversized = rejectOversizedBody(req, 2 * 1024);
  if (oversized) return oversized;

  const userId = await getCurrentUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const actor = await resolveOrderActor(userId);
  if (!actor) return NextResponse.json({ error: ACCOUNT_NOT_VERIFIED_MESSAGE }, { status: 403 });
  if (actor.channel !== "B2C") {
    return NextResponse.json({ error: "Checkout quotes are for customer accounts only" }, { status: 403 });
  }

  // Each quote below the free-delivery threshold is a live Delhivery rate call.
  const limited = await enforceRateLimit(req, "PUBLIC_API");
  if (limited) return limited;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { deliveryPincode, paymentMode = "Prepaid" } = (body ?? {}) as { deliveryPincode?: unknown; paymentMode?: unknown };

  if (typeof deliveryPincode !== "string" || !/^\d{6}$/.test(deliveryPincode)) {
    return NextResponse.json({ error: "Valid delivery pincode is required" }, { status: 400 });
  }
  if (paymentMode !== "Prepaid" && paymentMode !== "COD") {
    return NextResponse.json({ error: "paymentMode must be Prepaid or COD" }, { status: 400 });
  }

  const cart = await prisma.cart.findUnique({
    where: { customerId: actor.customer.id },
    include: { items: { include: { product: true, variant: true } } },
  });
  if (!cart || cart.items.length === 0) {
    return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
  }

  const priced = priceB2CCart(cart.items);
  if (!priced.ok) {
    return NextResponse.json(
      { error: priced.error, code: priced.code, unavailableProductIds: priced.productIds },
      { status: priced.status }
    );
  }

  const quote = await quoteB2CShipping({
    lines: cart.items,
    orderTotal: priced.orderTotal,
    deliveryPincode,
    paymentMode,
  });
  if (!quote.ok) {
    return NextResponse.json(
      { error: quote.error, code: quote.code, unavailableProductIds: quote.productIds },
      { status: quote.status }
    );
  }

  return NextResponse.json({
    orderTotal: quote.orderTotal,
    shippingCost: quote.shippingCost,
    grandTotal: quote.grandTotal,
    freeDelivery: quote.freeDelivery,
    source: quote.source,
  });
}
