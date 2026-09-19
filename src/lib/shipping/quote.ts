import { roundToPaise } from "@/lib/utils";
import type { OrderChannel } from "@prisma/client";

/**
 * Order total (subtotal + GST, already rounded) at/above which shipping is
 * free. Exported so both the order-creation route and the checkout page's
 * free-delivery progress bar read the same constant instead of two copies.
 */
export const FREE_DELIVERY_THRESHOLD = 25000;

export interface ShippingQuote {
  shippingCost: number;
}

/**
 * Flat-rate placeholder shipping — 5% of order total, free at/above
 * FREE_DELIVERY_THRESHOLD. The only shipping model used by order creation
 * today. The real Delhivery rate engine (lib/delhivery/rates.ts,
 * /api/shipping/estimate) is a separate, already-independent concern (used
 * only for the pincode-serviceability check today) — Phase 0 doesn't touch
 * it or fold it in here.
 *
 * `orderTotal` must already be rounded (roundToPaise) by the caller — this
 * function doesn't round its input, only its output.
 *
 * Fixed 2026-09-18 (B2C-EXPANSION-PLAN.md Phase 0): this exact formula used
 * to be duplicated in /api/orders/route.ts (server, authoritative — fed a
 * roundToPaise'd orderTotal) and dealer/checkout/page.tsx (client preview —
 * fed an *unrounded* sum of cart.subtotal + cart.gstAmount). The function
 * bodies were byte-identical, but the client's unrounded input meant its
 * free-delivery preview could disagree with what the server actually
 * charged by a fraction of a paisa right at the ₹25,000 boundary. Both call
 * sites now go through this one function with an identically-rounded
 * input, so that can't happen anymore. The golden test's Fixture C pins the
 * boundary exactly (orderTotal === 25000) and one paisa under it.
 */
function computeFlatRateShipping(orderTotal: number): ShippingQuote {
  if (orderTotal >= FREE_DELIVERY_THRESHOLD) return { shippingCost: 0 };
  return { shippingCost: roundToPaise(orderTotal * 0.05) };
}

/**
 * Channel-aware entry point (B2C-EXPANSION-PLAN.md Phase 0 — the channel
 * seam). Only one shipping strategy exists today; B2C gets its own rule
 * (real Delhivery rate + ₹49 floor, no free-shipping threshold — see the
 * plan's Decision D6) in a later phase. Until then both channels compute
 * identically — this branch is structure, not behavior.
 */
export function computeShippingQuote(params: {
  channel: OrderChannel;
  orderTotal: number;
}): ShippingQuote {
  if (params.channel === "B2C") {
    return computeFlatRateShipping(params.orderTotal);
  }
  return computeFlatRateShipping(params.orderTotal);
}
