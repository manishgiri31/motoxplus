import { roundToPaise } from "@/lib/utils";

/**
 * "GST Benefit Scheme" valuation — pure, DB-free (mirrors lib/orders/
 * cancellation.ts: callers fetch the Scheme row and pass its terms in, so
 * this stays unit-testable without mocking Prisma).
 *
 * benefit = taxableValue * benefitPercent / 100, capped at maxBenefitValue.
 * taxableValue is the dealer's cart/order subtotal EXCLUDING GST — the same
 * amount 18% GST would normally apply to, which is what makes "the benefit
 * equals the GST" true. Scheme items are valued at their real dealer price
 * (Product.price), never MRP and never a client-supplied number — the
 * caller must read price fresh from the DB per line before calling
 * valuateSchemeItems, same discipline as unitPrice in /api/orders today.
 *
 * Any unused benefit lapses — there is no "remaining benefit" persisted
 * anywhere beyond the current cart/order snapshot, so nothing here needs to
 * carry a balance forward.
 */

export interface SchemeTerms {
  benefitPercent: number;
  minOrderValue: number;
  maxBenefitValue: number | null;
}

export type SchemeIneligibleReason = "BELOW_MIN_ORDER_VALUE";

export type SchemeEligibility =
  | { eligible: true; benefit: number }
  | { eligible: false; benefit: 0; reason: SchemeIneligibleReason };

/** Whether an order/cart's taxable value clears the scheme's minimum, and if so, the benefit it earns. */
export function evaluateSchemeEligibility(params: {
  taxableValue: number;
  terms: SchemeTerms;
}): SchemeEligibility {
  const { taxableValue, terms } = params;
  if (taxableValue < terms.minOrderValue) {
    return { eligible: false, benefit: 0, reason: "BELOW_MIN_ORDER_VALUE" };
  }
  return { eligible: true, benefit: computeBenefit({ taxableValue, terms }) };
}

/** benefit = taxableValue * benefitPercent / 100, rounded to paise, capped at maxBenefitValue if set. */
export function computeBenefit(params: { taxableValue: number; terms: SchemeTerms }): number {
  const { taxableValue, terms } = params;
  const raw = roundToPaise((taxableValue * terms.benefitPercent) / 100);
  if (terms.maxBenefitValue != null) return Math.min(raw, terms.maxBenefitValue);
  return raw;
}

export interface SchemeItemInput {
  productId: string;
  quantity: number;
  /** Product.price at the moment of validation — read fresh by the caller, never trusted from the client. */
  dealerPrice: number;
}

export interface SchemeItemsValuation {
  itemsValue: number;
  withinBenefit: boolean;
  /** benefit − itemsValue, floored at 0 — how much of the benefit is still unused (for the "₹X me se ₹Y use hua" bar). */
  remaining: number;
}

/** Sums the selected scheme items at dealer price and checks the total against the benefit cap. */
export function valuateSchemeItems(params: { items: SchemeItemInput[]; benefit: number }): SchemeItemsValuation {
  const { items, benefit } = params;
  const itemsValue = roundToPaise(items.reduce((sum, item) => sum + item.dealerPrice * item.quantity, 0));
  return {
    itemsValue,
    withinBenefit: itemsValue <= benefit,
    remaining: Math.max(0, roundToPaise(benefit - itemsValue)),
  };
}

/** Scheme.startsAt/endsAt/isActive check — pure, takes `now` as a param so it's testable without mocking the clock. */
export function isSchemeWithinWindow(params: { isActive: boolean; startsAt: Date; endsAt: Date; now: Date }): boolean {
  const { isActive, startsAt, endsAt, now } = params;
  return isActive && now >= startsAt && now <= endsAt;
}
