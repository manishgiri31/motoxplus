import { describe, it, expect } from "vitest";
import {
  recomputeSchemeShortfall,
  computeFullCancelSchemeAdjustment,
  applySchemeAdjustmentToRefund,
  computeFullCancelWithRefund,
} from "./adjustment";
import type { SchemeTerms } from "./pricing";

const terms: SchemeTerms = { benefitPercent: 18, minOrderValue: 10000, maxBenefitValue: null };

// Case 1: partial cancel, shortfall zero — remaining order still justifies the granted itemsValue.
describe("recomputeSchemeShortfall — case 1: shortfall zero", () => {
  it("stays ACTIVE with no adjustment when the remaining taxable value still covers itemsValue", () => {
    const result = recomputeSchemeShortfall({
      terms,
      itemsValue: 5000, // granted when original taxableValue was 50000 (benefit 9000, dealer used 5000 of it)
      remainingTaxableValue: 40000, // one small item cancelled — new benefit 7200, still >= 5000
      alreadyAdjusted: 0,
    });
    expect(result).toEqual({
      newBenefit: 7200,
      shortfall: 0,
      incrementalAdjustment: 0,
      redemptionStatus: "ACTIVE",
    });
  });
});

// Case 2: partial cancel, shortfall positive.
describe("recomputeSchemeShortfall — case 2: shortfall positive", () => {
  it("goes ADJUSTED and charges the gap when remaining value no longer covers itemsValue", () => {
    const result = recomputeSchemeShortfall({
      terms,
      itemsValue: 5000,
      remainingTaxableValue: 20000, // new benefit 3600 < 5000 granted
      alreadyAdjusted: 0,
    });
    expect(result).toEqual({
      newBenefit: 3600,
      shortfall: 1400,
      incrementalAdjustment: 1400,
      redemptionStatus: "ADJUSTED",
    });
  });
});

// Case 3 & 4: whole-order cancel.
describe("computeFullCancelSchemeAdjustment — cases 3 & 4", () => {
  it("case 3: nothing dispatched -> zero adjustment, redemption CANCELLED", () => {
    expect(computeFullCancelSchemeAdjustment({ itemsValue: 5000, dispatched: false })).toEqual({
      schemeAdjustmentAmount: 0,
      redemptionStatus: "CANCELLED",
    });
  });

  it("case 4: already dispatched -> full itemsValue adjusted, redemption ADJUSTED", () => {
    expect(computeFullCancelSchemeAdjustment({ itemsValue: 5000, dispatched: true })).toEqual({
      schemeAdjustmentAmount: 5000,
      redemptionStatus: "ADJUSTED",
    });
  });

  it("case 4 rounds itemsValue to paise", () => {
    expect(computeFullCancelSchemeAdjustment({ itemsValue: 1234.567, dispatched: true }).schemeAdjustmentAmount).toBe(
      1234.57
    );
  });
});

// Case 5: multiple partial cancels on one order — incremental, never double-charged.
describe("recomputeSchemeShortfall — case 5: sequential partial cancels", () => {
  it("charges only the incremental gap on each successive cancel", () => {
    const itemsValue = 8000; // near the 9000 cap on a 50000 order

    // First cancel: order shrinks to 30000 taxable value.
    const first = recomputeSchemeShortfall({ terms, itemsValue, remainingTaxableValue: 30000, alreadyAdjusted: 0 });
    expect(first.newBenefit).toBe(5400);
    expect(first.shortfall).toBe(2600);
    expect(first.incrementalAdjustment).toBe(2600);

    // Order.schemeAdjustmentAmount is now updated to first.shortfall (2600) by the caller.
    let alreadyAdjusted = first.shortfall;

    // Second cancel: order shrinks further to 10000 taxable value.
    const second = recomputeSchemeShortfall({ terms, itemsValue, remainingTaxableValue: 10000, alreadyAdjusted });
    expect(second.newBenefit).toBe(1800);
    expect(second.shortfall).toBe(6200); // cumulative total shortfall
    expect(second.incrementalAdjustment).toBe(3600); // only the NEW gap (6200 - 2600), not the full 6200 again

    alreadyAdjusted = second.shortfall;

    // A no-op re-evaluation at the same remaining value (e.g. a retried/duplicate request) must not double-charge.
    const replay = recomputeSchemeShortfall({ terms, itemsValue, remainingTaxableValue: 10000, alreadyAdjusted });
    expect(replay.shortfall).toBe(6200);
    expect(replay.incrementalAdjustment).toBe(0);

    // Sanity: the two increments sum to the final total shortfall.
    expect(first.incrementalAdjustment + second.incrementalAdjustment).toBe(second.shortfall);
  });
});

// Case 6: a partial cancel that drops the order below minOrderValue — benefit fully ends, not scaled.
describe("recomputeSchemeShortfall — case 6: falls below minOrderValue", () => {
  it("zeroes the benefit entirely (not 18% of the small remainder) once below minOrderValue", () => {
    const result = recomputeSchemeShortfall({
      terms, // minOrderValue 10000
      itemsValue: 1800, // granted when the order was, say, 15000
      remainingTaxableValue: 5000, // below minOrderValue
      alreadyAdjusted: 0,
    });
    // Naive scaling would give newBenefit = 18% * 5000 = 900, shortfall 900.
    // The decided rule is a hard cutoff: newBenefit 0, full itemsValue owed back.
    expect(result.newBenefit).toBe(0);
    expect(result.shortfall).toBe(1800);
    expect(result.incrementalAdjustment).toBe(1800);
    expect(result.redemptionStatus).toBe("ADJUSTED");
  });

  it("is still a hard cutoff exactly at the minOrderValue boundary minus a paisa", () => {
    const result = recomputeSchemeShortfall({
      terms,
      itemsValue: 1800,
      remainingTaxableValue: 9999.99,
      alreadyAdjusted: 0,
    });
    expect(result.newBenefit).toBe(0);
    expect(result.shortfall).toBe(1800);
  });

  it("resumes normal proportional benefit exactly at minOrderValue", () => {
    const result = recomputeSchemeShortfall({
      terms,
      itemsValue: 1800,
      remainingTaxableValue: 10000,
      alreadyAdjusted: 0,
    });
    expect(result.newBenefit).toBe(1800); // 18% of 10000
    expect(result.shortfall).toBe(0);
  });
});

// Case 7: rounding to 2 decimals everywhere, and the refund-capping helper never goes negative.
describe("rounding and refund-capping — case 7", () => {
  it("recomputeSchemeShortfall rounds newBenefit/shortfall/incrementalAdjustment to paise", () => {
    const fractionalTerms: SchemeTerms = { benefitPercent: 18, minOrderValue: 0, maxBenefitValue: null };
    const result = recomputeSchemeShortfall({
      terms: fractionalTerms,
      itemsValue: 2222.226,
      remainingTaxableValue: 12345.67, // newBenefit = 12345.67 * 0.18 = 2222.2206 -> rounds to 2222.22
      alreadyAdjusted: 0,
    });
    expect(result.newBenefit).toBe(2222.22);
    expect(result.shortfall).toBe(0.01); // 2222.226 - 2222.22 = 0.006 -> rounds to 0.01
    expect(result.incrementalAdjustment).toBe(0.01);
  });

  it("applySchemeAdjustmentToRefund caps the adjustment at the available refund — refund never goes negative", () => {
    const result = applySchemeAdjustmentToRefund({ refundBeforeAdjustment: 1000, schemeAdjustment: 3000 });
    expect(result).toEqual({ adjustmentApplied: 1000, refundAfterAdjustment: 0 });
  });

  it("applySchemeAdjustmentToRefund deducts normally when the refund pool covers it", () => {
    const result = applySchemeAdjustmentToRefund({ refundBeforeAdjustment: 5000, schemeAdjustment: 1400 });
    expect(result).toEqual({ adjustmentApplied: 1400, refundAfterAdjustment: 3600 });
  });

  it("applySchemeAdjustmentToRefund is a no-op when there is nothing to adjust", () => {
    expect(applySchemeAdjustmentToRefund({ refundBeforeAdjustment: 5000, schemeAdjustment: 0 })).toEqual({
      adjustmentApplied: 0,
      refundAfterAdjustment: 5000,
    });
  });

  it("applySchemeAdjustmentToRefund never goes negative even with a zero/negative refund pool", () => {
    expect(applySchemeAdjustmentToRefund({ refundBeforeAdjustment: 0, schemeAdjustment: 500 })).toEqual({
      adjustmentApplied: 0,
      refundAfterAdjustment: 0,
    });
    expect(applySchemeAdjustmentToRefund({ refundBeforeAdjustment: -10, schemeAdjustment: 500 })).toEqual({
      adjustmentApplied: 0,
      refundAfterAdjustment: 0,
    });
  });
});

// Case 8: the composed whole-order-cancel + refund helper both the cancellation
// preview and the actual cancel endpoint share.
describe("computeFullCancelWithRefund — case 8", () => {
  it("nothing dispatched -> no adjustment, full refund untouched, redemption CANCELLED", () => {
    const result = computeFullCancelWithRefund({ itemsValue: 5000, dispatched: false, refundBeforeAdjustment: 9000 });
    expect(result).toEqual({
      schemeAdjustmentAmount: 0,
      adjustmentApplied: 0,
      uncollectedShortfall: 0,
      refundAfterAdjustment: 9000,
      redemptionStatus: "CANCELLED",
    });
  });

  it("dispatched, refund pool covers the full clawback -> no dealer dues", () => {
    const result = computeFullCancelWithRefund({ itemsValue: 5000, dispatched: true, refundBeforeAdjustment: 9000 });
    expect(result).toEqual({
      schemeAdjustmentAmount: 5000,
      adjustmentApplied: 5000,
      uncollectedShortfall: 0,
      refundAfterAdjustment: 4000,
      redemptionStatus: "ADJUSTED",
    });
  });

  it("dispatched, refund pool insufficient -> refund floored at 0, remainder is the uncollected shortfall", () => {
    const result = computeFullCancelWithRefund({ itemsValue: 5000, dispatched: true, refundBeforeAdjustment: 3000 });
    expect(result).toEqual({
      schemeAdjustmentAmount: 5000,
      adjustmentApplied: 3000,
      uncollectedShortfall: 2000,
      refundAfterAdjustment: 0,
      redemptionStatus: "ADJUSTED",
    });
  });
});
