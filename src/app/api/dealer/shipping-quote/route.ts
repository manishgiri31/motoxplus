import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { resolveOrderActor, ACCOUNT_NOT_VERIFIED_MESSAGE } from "@/lib/auth/verified-account";
import { enforceRateLimit, rejectOversizedBody } from "@/lib/auth/rate-limit-budgets";
import { quoteDealerShipping } from "@/lib/shipping/dealer-checkout";

/**
 * POST /api/dealer/shipping-quote — the dealer checkout's shipping line.
 *
 * Body: { deliveryPincode: "135001", paymentType: "ADVANCE_20" | "FULL_100" | "DIRECT_UPI" }
 * The cart is the signed-in dealer's own cart, read here. The same function POST /api/orders charges with
 * (lib/shipping/dealer-checkout.ts) computes the number, so the displayed total and the charged total match.
 */
export async function POST(req: NextRequest) {
  const oversized = rejectOversizedBody(req, 2 * 1024);
  if (oversized) return oversized;

  const userId = await getCurrentUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const actor = await resolveOrderActor(userId);
  if (!actor) return NextResponse.json({ error: ACCOUNT_NOT_VERIFIED_MESSAGE }, { status: 403 });
  if (actor.channel !== "B2B") {
    return NextResponse.json({ error: "Dealer shipping quotes are for dealer accounts only" }, { status: 403 });
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
  const { deliveryPincode, paymentType = "FULL_100" } = (body ?? {}) as {
    deliveryPincode?: unknown;
    paymentType?: unknown;
  };

  if (typeof deliveryPincode !== "string" || !/^\d{6}$/.test(deliveryPincode)) {
    return NextResponse.json({ error: "Valid delivery pincode is required" }, { status: 400 });
  }
  if (typeof paymentType !== "string") {
    return NextResponse.json({ error: "paymentType is required" }, { status: 400 });
  }

  const cart = await prisma.cart.findUnique({
    where: { dealerId: actor.dealer.id },
    include: { items: { include: { product: true, variant: true } } },
  });
  if (!cart || cart.items.length === 0) {
    return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
  }

  const result = await quoteDealerShipping({
    items: cart.items as any,
    deliveryPincode,
    paymentType,
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, code: result.code, unavailableProductIds: result.productIds },
      { status: result.status }
    );
  }

  return NextResponse.json({
    orderTotal: result.orderTotal,
    shippingCost: result.shippingCost,
    grandTotal: result.grandTotal,
    freeDelivery: result.freeDelivery,
    source: result.source,
  });
}
