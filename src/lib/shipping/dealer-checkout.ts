import { roundToPaise } from "@/lib/utils";
import { computeOrderPricing } from "@/lib/pricing/compute";
import { quoteB2CShipping, type B2CCartLine, type B2CCheckoutError, type B2CShippingQuote } from "./b2c-checkout";

/**
 * Dealer (B2B) checkout pricing + shipping, shared by POST /api/orders (dealer branch) and the dealer
 * shipping-quote endpoint. Shipping is the real Delhivery charge for the whole order (quantity included),
 * from the pickup warehouse to the delivery pincode, free at/above the free-delivery threshold.
 * Scheme (free) lines are not priced, but they still ship, so they count toward the weight.
 */

export type DealerCartLine = B2CCartLine & { isSchemeItem?: boolean };

export type DealerShippingResult =
  | { ok: true; orderTotal: number; shippingCost: number; grandTotal: number; freeDelivery: boolean; source: B2CShippingQuote["source"]; pickupLocationName: string | null }
  | B2CCheckoutError;

/** Advance (20%) orders are collected as COD at delivery; full-payment orders are prepaid. */
export function dealerPaymentModeFor(paymentType: string): "Prepaid" | "COD" {
  return paymentType === "ADVANCE_20" ? "COD" : "Prepaid";
}

export async function quoteDealerShipping(params: {
  items: DealerCartLine[];
  deliveryPincode: string;
  paymentType: string;
}): Promise<DealerShippingResult> {
  const regular = params.items.filter((item) => !item.isSchemeItem);

  const pricing = computeOrderPricing({
    channel: "B2B",
    items: regular.map((item) => ({
      productId: item.productId,
      variantId: item.variantId,
      variantLabel: item.variant?.label ?? null,
      variantSku: item.variant?.sku ?? null,
      quantity: item.quantity,
      unitPrice: item.variant?.price ?? item.product.price,
      gstRate: item.product.gstRate,
    })),
  });
  const orderTotal = roundToPaise(pricing.subtotal + pricing.gstAmount);

  const quote = await quoteB2CShipping({
    channel: "B2B",
    lines: params.items,
    orderTotal,
    deliveryPincode: params.deliveryPincode,
    paymentMode: dealerPaymentModeFor(params.paymentType),
    // Advance orders carry the COD amount to the courier; the rate input is the order total.
  });
  if (!quote.ok) return quote;

  return {
    ok: true,
    orderTotal,
    shippingCost: quote.shippingCost,
    grandTotal: quote.grandTotal,
    freeDelivery: quote.freeDelivery,
    source: quote.source,
    pickupLocationName: quote.pickupLocationName,
  };
}
