import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { calculateShippingRate } from "@/lib/delhivery";
import { resolveCheckoutPickup } from "@/lib/delhivery/pickup-location";
import { resolveOriginPincode } from "@/lib/shipping/b2c-checkout";

/**
 * POST /api/shipping/estimate — a rough rate for a weight to a pincode, with no cart behind it.
 * Not used by the web checkout (that is POST /api/shipping/checkout-quote, which quotes the real cart);
 * kept because the mobile app's shippingService still exposes it.
 *
 * Origin is resolved the same way an order of MotoXPlus's own stock would be: the MOTOXPLUS
 * DelhiveryWarehouse row's pin when there is one, otherwise DELHIVERY_ORIGIN_PINCODE — never a hardcoded pin.
 */
export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { destinationPincode, weightKg, paymentMode, codAmount } = body;

  if (!destinationPincode || !weightKg) {
    return NextResponse.json(
      { error: "destinationPincode and weightKg are required" },
      { status: 400 }
    );
  }

  // One stand-in line of MotoXPlus's own stock, so the pickup rule is the order route's, not a copy of it.
  const pickup = await resolveCheckoutPickup("B2C", [{ productId: "estimate", product: { source: "MOTOXPLUS", vendorId: null } }]);
  const originPincode = pickup.ok ? await resolveOriginPincode(pickup.pickupLocationName) : null;
  if (!originPincode) {
    return NextResponse.json({ error: "Pickup pincode is not configured", code: "SHIPPING_RATE_UNAVAILABLE" }, { status: 503 });
  }

  const result = await calculateShippingRate({
    originPincode,
    destinationPincode,
    weightKg: Number(weightKg),
    paymentMode: paymentMode || "Prepaid",
    codAmount: codAmount ? Number(codAmount) : undefined,
  });

  // The ₹100 "default" is what calculateShippingRate returns when every real source failed — not a rate.
  if (result.source === "default") {
    return NextResponse.json(
      { error: "Delivery charge could not be calculated right now.", code: "SHIPPING_RATE_UNAVAILABLE" },
      { status: 503 }
    );
  }

  return NextResponse.json(result);
}
