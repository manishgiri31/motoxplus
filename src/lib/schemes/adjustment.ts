import { roundToPaise } from "@/lib/utils";
import { evaluateSchemeEligibility, type SchemeTerms } from "./pricing";

/**
 * "GST Benefit Scheme" cancellation-time money adjustment — pure, DB-free
 * (same style as pricing.ts / lib/orders/cancellation.ts). Goods are never
 * asked back; instead, when the remaining order no longer earns the benefit
 * already granted, the shortfall is deducted from the refund as its own
 * "Scheme Adjustment" line, kept separate from any cancellation fee.
 *
 * Deliberately decoupled from "cancellation": recomputeSchemeShortfall takes
 * `remainingTaxableValue` — the taxable value of whatever is still kept —
 * not "what was cancelled". A future post-delivery return flow (which
 * doesn't exist in this codebase yet) reduces the kept value the same way a
 * partial cancellation does, so it can call this same function.
 */

export interface SchemeShortfallInput {
  terms: SchemeTerms;
  /** The scheme redemption's granted item value (dealer price total) — fixed unless the dealer separately drops a scheme item. */
  itemsValue: number;
  /** Taxable value of whatever the order still has (post this event) — not the value of what was removed. */
  remainingTaxableValue: number;
  /** Order.schemeAdjustmentAmount so far — the cumulative amount ALREADY deducted, so a re-evaluation never re-charges it. */
  alreadyAdjusted: number;
}

export interface SchemeShortfallResult {
  /** Benefit the remaining order still earns. 0 if remainingTaxableValue no longer clears terms.minOrderValue — dropping
   *  below the minimum ends the benefit entirely, it does not just scale down proportionally. */
  newBenefit: number;
  /** Cumulative total shortfall as of now: max(0, itemsValue − newBenefit). Monotonically non-decreasing across
   *  successive calls as remainingTaxableValue falls, unless itemsValue itself is reduced (dealer drops a scheme item). */
  shortfall: number;
  /** What to actually charge THIS time: max(0, shortfall − alreadyAdjusted). 0 when a re-evaluation finds nothing new. */
  incrementalAdjustment: number;
  /** ADJUSTED once any shortfall exists, ACTIVE while itemsValue is still fully justified. */
  redemptionStatus: "ACTIVE" | "ADJUSTED";
}

export function recomputeSchemeShortfall(params: SchemeShortfallInput): SchemeShortfallResult {
  const { terms, itemsValue, remainingTaxableValue, alreadyAdjusted } = params;

  const eligibility = evaluateSchemeEligibility({ taxableValue: remainingTaxableValue, terms });
  const newBenefit = eligibility.eligible ? eligibility.benefit : 0;

  const shortfall = Math.max(0, roundToPaise(itemsValue - newBenefit));
  const incrementalAdjustment = Math.max(0, roundToPaise(shortfall - alreadyAdjusted));

  return {
    newBenefit,
    shortfall,
    incrementalAdjustment,
    redemptionStatus: shortfall > 0 ? "ADJUSTED" : "ACTIVE",
  };
}

export interface FullCancelSchemeAdjustmentInput {
  /** The scheme redemption's granted item value (dealer price total). */
  itemsValue: number;
  /** Whether anything on the order had already left the warehouse at the moment of whole-order cancellation. */
  dispatched: boolean;
}

export interface FullCancelSchemeAdjustmentResult {
  schemeAdjustmentAmount: number;
  redemptionStatus: "CANCELLED" | "ADJUSTED";
}

/**
 * Whole-order cancellation only (not partial — see recomputeSchemeShortfall for that, and for a future return flow).
 * Nothing dispatched: the scheme goods never left the warehouse, so the redemption is simply voided, no charge.
 * Something dispatched: the dealer keeps whatever scheme goods went out, so their full granted value is clawed back.
 */
export function computeFullCancelSchemeAdjustment(
  params: FullCancelSchemeAdjustmentInput
): FullCancelSchemeAdjustmentResult {
  if (!params.dispatched) {
    return { schemeAdjustmentAmount: 0, redemptionStatus: "CANCELLED" };
  }
  return { schemeAdjustmentAmount: roundToPaise(params.itemsValue), redemptionStatus: "ADJUSTED" };
}

export interface ApplySchemeAdjustmentInput {
  /** The refund this cancellation/return would otherwise pay out, after any cancellation fee — before the scheme adjustment. */
  refundBeforeAdjustment: number;
  /** The scheme adjustment this event wants to collect (e.g. incrementalAdjustment or a full-cancel schemeAdjustmentAmount). */
  schemeAdjustment: number;
}

export interface ApplySchemeAdjustmentResult {
  /** What actually got deducted — capped at refundBeforeAdjustment, since there's no other pool to take it from here. */
  adjustmentApplied: number;
  /** Never negative. */
  refundAfterAdjustment: number;
}

/**
 * Caps the scheme adjustment at the refund actually available, so refundAfterAdjustment can never go negative. If
 * schemeAdjustment exceeds the refund pool, only the affordable part is applied here — the caller is responsible for
 * deciding what (if anything) to do about the uncollected remainder, this function only guarantees a non-negative refund.
 */
export function applySchemeAdjustmentToRefund(params: ApplySchemeAdjustmentInput): ApplySchemeAdjustmentResult {
  const available = Math.max(0, params.refundBeforeAdjustment);
  const adjustmentApplied = roundToPaise(Math.min(Math.max(0, params.schemeAdjustment), available));
  const refundAfterAdjustment = roundToPaise(available - adjustmentApplied);
  return { adjustmentApplied, refundAfterAdjustment };
}
