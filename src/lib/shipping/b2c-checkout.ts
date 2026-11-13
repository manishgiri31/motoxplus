import { prisma } from "@/lib/prisma";
import { roundToPaise } from "@/lib/utils";
import { computeOrderPricing, type OrderPricing, type PricingItemInput } from "@/lib/pricing/compute";
import { resolveUnitPrice } from "@/lib/pricing/resolve";
import { calculateShippingRate, calculateOrderWeight } from "@/lib/delhivery/rates";
import { resolveCheckoutPickup, type CheckoutPickupCode } from "@/lib/delhivery/pickup-location";
import type { RateResult } from "@/lib/delhivery/types";
import { FREE_DELIVERY_THRESHOLD } from "./quote";

/**
 * B2C checkout pricing + shipping, shared by POST /api/orders (what the customer is charged) and
 * POST /api/shipping/checkout-quote (what the checkout page shows). Both call these two functions with
 * the same cart, so the displayed total and the charged total cannot drift apart.
 */

/** A B2C cart line as loaded by `prisma.cart.findUnique({ include: { items: { include: { product: true, variant: true } } } })`. */
export interface B2CCartLine {
  productId: string;
  variantId: string | null;
  quantity: number;
  product: {
    isActive: boolean;
    stockStatus: string;
    mrp: number | null;
    price: number;
    gstRate: number;
    source: string;
    vendorId: string | null;
    weight?: number | null;
    packageWeight?: number | null;
  };
  variant: { isActive: boolean; stock: number; label: string; mrp: number | null; price: number; sku?: string | null } | null;
}

export type B2CCheckoutError = {
  ok: false;
  status: 409 | 503;
  code?: CheckoutPickupCode | "ITEMS_UNAVAILABLE" | "ITEMS_UNPRICED" | "SHIPPING_RATE_UNAVAILABLE";
  error: string;
  productIds?: string[];
};

export type B2CCartPricing = {
  ok: true;
  items: PricingItemInput[];
  pricing: OrderPricing;
  /** subtotal + GST, rounded — the figure the free-delivery threshold is measured against. */
  orderTotal: number;
};

/**
 * Re-checks availability and re-resolves every line's retail price (Product.mrp / variant.mrp) right now.
 * Never trusts the cart to have snapshotted a price, and never falls back to the wholesale rate.
 */
export function priceB2CCart(lines: B2CCartLine[]): B2CCartPricing | B2CCheckoutError {
  // Cart items can sit for a long time between add-to-cart and checkout.
  const unavailable = lines.filter((item) => {
    if (!item.product.isActive) return true;
    if (item.variant) return !item.variant.isActive || item.variant.stock < item.quantity;
    return item.product.stockStatus === "OUT_OF_STOCK";
  });
  if (unavailable.length > 0) {
    return {
      ok: false,
      status: 409,
      code: "ITEMS_UNAVAILABLE",
      error: "Some items in your cart are no longer available in the requested quantity. Please update your cart.",
      productIds: unavailable.map((i) => i.productId),
    };
  }

  const unpriced: string[] = [];
  const items: PricingItemInput[] = lines.map((item) => {
    const unitPrice = resolveUnitPrice({ channel: "B2C", product: item.product, variant: item.variant });
    if (unitPrice === null) unpriced.push(item.productId);
    return {
      productId: item.productId,
      variantId: item.variantId,
      variantLabel: item.variant?.label ?? null,
      variantSku: item.variant?.sku ?? null,
      quantity: item.quantity,
      unitPrice: unitPrice ?? 0,
      gstRate: item.product.gstRate,
    };
  });
  if (unpriced.length > 0) {
    return {
      ok: false,
      status: 409,
      code: "ITEMS_UNPRICED",
      error: "Some items in your cart are no longer available for retail purchase. Please remove them.",
      productIds: unpriced,
    };
  }

  const pricing = computeOrderPricing({ channel: "B2C", items });
  return { ok: true, items, pricing, orderTotal: roundToPaise(pricing.subtotal + pricing.gstAmount) };
}

/**
 * The pin a shipment is collected from: the pickup warehouse's own pin, or DELHIVERY_ORIGIN_PINCODE for the
 * configured MotoXPlus location (pickupLocationName null, or a name with no DelhiveryWarehouse row). There is
 * deliberately no hardcoded fallback — null means "not configured" and the caller must refuse to quote.
 */
export async function resolveOriginPincode(pickupLocationName: string | null): Promise<string | null> {
  const warehouse = pickupLocationName
    ? await prisma.delhiveryWarehouse.findFirst({ where: { delhiveryName: pickupLocationName }, select: { pin: true } })
    : null;
  return warehouse?.pin || process.env.DELHIVERY_ORIGIN_PINCODE?.trim() || null;
}

export type B2CShippingQuote = {
  ok: true;
  /** Order.pickupLocationName — null means the configured MotoXPlus location. */
  pickupLocationName: string | null;
  orderTotal: number;
  shippingCost: number;
  grandTotal: number;
  freeDelivery: boolean;
  /** Where shippingCost came from. "free" = at/above FREE_DELIVERY_THRESHOLD, no rate was fetched. */
  source: "free" | Exclude<RateResult["source"], "default">;
};

/**
 * Shipping for a B2C order: the real Delhivery rate from the pickup warehouse's own pin (fallback
 * DELHIVERY_ORIGIN_PINCODE) to the customer's pin, free at/above FREE_DELIVERY_THRESHOLD on the order total
 * (incl. GST). Free delivery is MotoXPlus's cost, so no rate is fetched then.
 *
 * calculateShippingRate's last resort is a flat ₹100 "default" when Delhivery and the DB slabs both fail.
 * That number is a guess, not a rate — it is returned here as an error so it is never shown or charged.
 */
export async function quoteB2CShipping(params: {
  lines: Array<B2CCartLine>;
  orderTotal: number;
  deliveryPincode: string;
  paymentMode: "Prepaid" | "COD";
}): Promise<B2CShippingQuote | B2CCheckoutError> {
  const { lines, orderTotal, deliveryPincode, paymentMode } = params;

  // One order = one Delhivery shipment = one pickup location (vendor items need that vendor's ACTIVE warehouse).
  const pickup = await resolveCheckoutPickup("B2C", lines);
  if (!pickup.ok) {
    return { ok: false, status: 409, code: pickup.code, error: pickup.error, productIds: pickup.productIds };
  }

  const base = { pickupLocationName: pickup.pickupLocationName, orderTotal };

  if (orderTotal >= FREE_DELIVERY_THRESHOLD) {
    return { ok: true, ...base, shippingCost: 0, grandTotal: orderTotal, freeDelivery: true, source: "free" };
  }

  const originPincode = await resolveOriginPincode(pickup.pickupLocationName);
  if (!originPincode) {
    return { ok: false, status: 503, code: "SHIPPING_RATE_UNAVAILABLE", error: "Pickup pincode is not configured" };
  }

  const rate = await calculateShippingRate({
    originPincode,
    destinationPincode: deliveryPincode,
    weightKg: calculateOrderWeight(lines),
    paymentMode,
    // The rate's COD input is the order total; the shipping share is added after.
    codAmount: paymentMode === "COD" ? orderTotal : 0,
  });
  if (rate.source === "default") {
    return {
      ok: false,
      status: 503,
      code: "SHIPPING_RATE_UNAVAILABLE",
      error: "Delivery charge could not be calculated right now. Please try again in a few minutes.",
    };
  }

  const shippingCost = roundToPaise(rate.shippingCost);
  return {
    ok: true,
    ...base,
    shippingCost,
    grandTotal: roundToPaise(orderTotal + shippingCost),
    freeDelivery: false,
    source: rate.source,
  };
}
