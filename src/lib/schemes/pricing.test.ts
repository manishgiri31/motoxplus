import { describe, it, expect } from "vitest";
import {
  computeBenefit,
  evaluateSchemeEligibility,
  valuateSchemeItems,
  isSchemeWithinWindow,
  type SchemeTerms,
} from "./pricing";

const terms: SchemeTerms = { benefitPercent: 18, minOrderValue: 10000, maxBenefitValue: null };

describe("computeBenefit", () => {
  it("computes 18% of taxable value, rounded to paise", () => {
    expect(computeBenefit({ taxableValue: 50000, terms })).toBe(9000);
    expect(computeBenefit({ taxableValue: 12345.67, terms })).toBe(2222.22);
  });

  it("caps at maxBenefitValue when set", () => {
    const capped: SchemeTerms = { ...terms, maxBenefitValue: 5000 };
    expect(computeBenefit({ taxableValue: 50000, terms: capped })).toBe(5000);
    // below the cap — uncapped value wins
    expect(computeBenefit({ taxableValue: 10000, terms: capped })).toBe(1800);
  });

  it("respects a non-default benefitPercent", () => {
    const tenPercent: SchemeTerms = { ...terms, benefitPercent: 10 };
    expect(computeBenefit({ taxableValue: 20000, terms: tenPercent })).toBe(2000);
  });
});

describe("evaluateSchemeEligibility", () => {
  it("rejects orders below minOrderValue", () => {
    expect(evaluateSchemeEligibility({ taxableValue: 9999, terms })).toEqual({
      eligible: false,
      benefit: 0,
      reason: "BELOW_MIN_ORDER_VALUE",
    });
  });

  it("accepts orders exactly at minOrderValue", () => {
    expect(evaluateSchemeEligibility({ taxableValue: 10000, terms })).toEqual({
      eligible: true,
      benefit: 1800,
    });
  });

  it("accepts orders above minOrderValue and returns the computed benefit", () => {
    expect(evaluateSchemeEligibility({ taxableValue: 50000, terms })).toEqual({
      eligible: true,
      benefit: 9000,
    });
  });
});

describe("valuateSchemeItems", () => {
  it("sums items at dealer price (not MRP) and flags within-benefit", () => {
    const result = valuateSchemeItems({
      items: [
        { productId: "p1", quantity: 2, dealerPrice: 1500 },
        { productId: "p2", quantity: 1, dealerPrice: 3000 },
      ],
      benefit: 9000,
    });
    expect(result).toEqual({ itemsValue: 6000, withinBenefit: true, remaining: 3000 });
  });

  it("flags over-benefit selections without throwing — caller decides to reject", () => {
    const result = valuateSchemeItems({
      items: [{ productId: "p1", quantity: 5, dealerPrice: 2000 }],
      benefit: 9000,
    });
    expect(result.itemsValue).toBe(10000);
    expect(result.withinBenefit).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("treats exactly-at-benefit as within benefit (<=, not <)", () => {
    const result = valuateSchemeItems({
      items: [{ productId: "p1", quantity: 1, dealerPrice: 9000 }],
      benefit: 9000,
    });
    expect(result.withinBenefit).toBe(true);
    expect(result.remaining).toBe(0);
  });

  it("returns zero valuation for an empty item list", () => {
    expect(valuateSchemeItems({ items: [], benefit: 9000 })).toEqual({
      itemsValue: 0,
      withinBenefit: true,
      remaining: 9000,
    });
  });
});

describe("isSchemeWithinWindow", () => {
  const startsAt = new Date("2026-01-01T00:00:00Z");
  const endsAt = new Date("2026-01-31T23:59:59Z");

  it("is true when active and inside the date window", () => {
    expect(
      isSchemeWithinWindow({ isActive: true, startsAt, endsAt, now: new Date("2026-01-15T00:00:00Z") })
    ).toBe(true);
  });

  it("is false when isActive is false, even inside the window", () => {
    expect(
      isSchemeWithinWindow({ isActive: false, startsAt, endsAt, now: new Date("2026-01-15T00:00:00Z") })
    ).toBe(false);
  });

  it("is false before startsAt or after endsAt", () => {
    expect(
      isSchemeWithinWindow({ isActive: true, startsAt, endsAt, now: new Date("2025-12-31T00:00:00Z") })
    ).toBe(false);
    expect(
      isSchemeWithinWindow({ isActive: true, startsAt, endsAt, now: new Date("2026-02-01T00:00:00Z") })
    ).toBe(false);
  });

  it("includes the boundary instants", () => {
    expect(isSchemeWithinWindow({ isActive: true, startsAt, endsAt, now: startsAt })).toBe(true);
    expect(isSchemeWithinWindow({ isActive: true, startsAt, endsAt, now: endsAt })).toBe(true);
  });
});
