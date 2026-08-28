import { describe, it, expect } from "vitest";
import {
  evaluateCancellation,
  calculateCancellation,
  stageOf,
  isDealerPostShipBlocked,
  evaluateDealerGateLocal,
  resolveDealerGateFromCarrier,
  defaultAdminStageFromCarrier,
  DEFAULT_CANCELLATION_POLICY,
} from "./cancellation";

const policy = DEFAULT_CANCELLATION_POLICY; // 2% pre-ship / 20% post-ship

describe("stageOf", () => {
  it("maps PENDING/CONFIRMED/PROCESSING to PRE_SHIP and SHIPPED to POST_SHIP", () => {
    expect(stageOf("PENDING")).toBe("PRE_SHIP");
    expect(stageOf("CONFIRMED")).toBe("PRE_SHIP");
    expect(stageOf("PROCESSING")).toBe("PRE_SHIP");
    expect(stageOf("SHIPPED")).toBe("POST_SHIP");
  });

  it("returns null for terminal statuses", () => {
    expect(stageOf("DELIVERED")).toBeNull();
    expect(stageOf("CANCELLED")).toBeNull();
    expect(stageOf("RETURNED")).toBeNull();
  });
});

describe("evaluateCancellation + calculateCancellation — pre-ship prepaid", () => {
  it("charges the pre-ship % on a FULL_100 order before dispatch", () => {
    const eligibility = evaluateCancellation({ status: "CONFIRMED", paymentType: "FULL_100", policy });
    expect(eligibility).toEqual({ ok: true, stage: "PRE_SHIP", feePercent: 2 });

    const quote = calculateCancellation({ feePercent: 2, amountPaid: 10000 });
    expect(quote).toEqual({ feePercent: 2, feeAmount: 200, refundAmount: 9800, waived: false });
  });

  it("applies the same pre-ship % to PENDING and PROCESSING", () => {
    for (const status of ["PENDING", "PROCESSING"] as const) {
      const eligibility = evaluateCancellation({ status, paymentType: "FULL_100", policy });
      expect(eligibility).toMatchObject({ ok: true, stage: "PRE_SHIP", feePercent: 2 });
    }
  });
});

describe("evaluateCancellation + calculateCancellation — post-ship prepaid", () => {
  it("charges the post-ship % on a FULL_100 order once shipped", () => {
    const eligibility = evaluateCancellation({ status: "SHIPPED", paymentType: "FULL_100", policy });
    expect(eligibility).toEqual({ ok: true, stage: "POST_SHIP", feePercent: 20 });

    const quote = calculateCancellation({ feePercent: 20, amountPaid: 10000 });
    expect(quote).toEqual({ feePercent: 20, feeAmount: 2000, refundAmount: 8000, waived: false });
  });
});

describe("advance-payment (ADVANCE_20) partial refund", () => {
  it("computes the fee against amountPaid (the captured advance), not grandTotal", () => {
    // Grand total 10,000, only the 20% advance (2,000) was ever captured.
    const eligibility = evaluateCancellation({ status: "CONFIRMED", paymentType: "ADVANCE_20", policy });
    expect(eligibility).toMatchObject({ ok: true, stage: "PRE_SHIP", feePercent: 2 });

    const quote = calculateCancellation({ feePercent: eligibility.ok ? eligibility.feePercent : 0, amountPaid: 2000 });
    expect(quote).toEqual({ feePercent: 2, feeAmount: 40, refundAmount: 1960, waived: false });
  });

  it("charges the post-ship % against the same captured advance once shipped", () => {
    const eligibility = evaluateCancellation({ status: "SHIPPED", paymentType: "ADVANCE_20", policy });
    expect(eligibility).toMatchObject({ ok: true, stage: "POST_SHIP", feePercent: 20 });

    const quote = calculateCancellation({ feePercent: 20, amountPaid: 2000 });
    expect(quote).toEqual({ feePercent: 20, feeAmount: 400, refundAmount: 1600, waived: false });
  });
});

describe("pure COD, pre-ship — charge waived", () => {
  it("allows cancellation with a 0 charge and 0 refund when nothing was paid", () => {
    const eligibility = evaluateCancellation({ status: "CONFIRMED", paymentType: "COD", policy });
    expect(eligibility).toEqual({ ok: true, stage: "PRE_SHIP", feePercent: 2 });

    const quote = calculateCancellation({ feePercent: 2, amountPaid: 0 });
    expect(quote).toEqual({ feePercent: 2, feeAmount: 0, refundAmount: 0, waived: true });
  });
});

describe("post-ship COD — blocked", () => {
  it("refuses cancellation once a COD order has shipped", () => {
    const eligibility = evaluateCancellation({ status: "SHIPPED", paymentType: "COD", policy });
    expect(eligibility).toEqual({
      ok: false,
      code: "COD_AFTER_SHIPPING",
      message: "Shipped COD orders cannot be cancelled online, contact support.",
    });
  });
});

describe("delivered — blocked", () => {
  it("refuses cancellation regardless of payment type", () => {
    for (const paymentType of ["FULL_100", "ADVANCE_20", "COD"] as const) {
      const eligibility = evaluateCancellation({ status: "DELIVERED", paymentType, policy });
      expect(eligibility).toMatchObject({ ok: false, code: "DELIVERED" });
    }
  });
});

describe("already cancelled / returned — blocked", () => {
  it("refuses re-cancellation", () => {
    expect(evaluateCancellation({ status: "CANCELLED", paymentType: "FULL_100", policy })).toMatchObject({
      ok: false,
      code: "ALREADY_CANCELLED",
    });
  });

  it("refuses cancellation once a return is in flight", () => {
    expect(evaluateCancellation({ status: "RETURNED", paymentType: "FULL_100", policy })).toMatchObject({
      ok: false,
      code: "RETURNED",
    });
  });
});

describe("isDealerPostShipBlocked — stopgap pending cancelDelhiveryShipment wiring (docs/delhivery-open-items.md item 1)", () => {
  it("blocks a dealer cancelling a SHIPPED order", () => {
    expect(isDealerPostShipBlocked("SHIPPED", true)).toBe(true);
  });

  it("does not block a dealer cancelling pre-shipment (PENDING/CONFIRMED/PROCESSING) — unchanged", () => {
    for (const status of ["PENDING", "CONFIRMED", "PROCESSING"] as const) {
      expect(isDealerPostShipBlocked(status, true)).toBe(false);
    }
  });

  it("does not block admin-initiated cancellation of a SHIPPED order", () => {
    expect(isDealerPostShipBlocked("SHIPPED", false)).toBe(false);
  });

  it("does not additionally block DELIVERED/CANCELLED/RETURNED for a dealer — evaluateCancellation already blocks those for everyone", () => {
    for (const status of ["DELIVERED", "CANCELLED", "RETURNED"] as const) {
      expect(isDealerPostShipBlocked(status, true)).toBe(false);
    }
  });

  it("leaves evaluateCancellation's own SHIPPED eligibility untouched (admin-usable 20% post-ship rate still computed correctly)", () => {
    // Confirms the stopgap is purely additive: evaluateCancellation itself
    // still returns exactly what it did before, for whoever isn't blocked
    // by isDealerPostShipBlocked at the call site (i.e. admins).
    const eligibility = evaluateCancellation({ status: "SHIPPED", paymentType: "FULL_100", policy });
    expect(eligibility).toEqual({ ok: true, stage: "POST_SHIP", feePercent: 20 });
  });
});

describe("evaluateDealerGateLocal — carrier-aware dealer gate (F-02 / F-04)", () => {
  const STALE = 3;

  it("ALLOWs when there is no shipment (nothing dispatched)", () => {
    expect(evaluateDealerGateLocal({ orderStatus: "CONFIRMED", shipment: null, carrierStaleDays: STALE })).toBe("ALLOW");
  });

  it("BLOCKs when Order.status is already SHIPPED (unchanged fast-path)", () => {
    expect(evaluateDealerGateLocal({ orderStatus: "SHIPPED", shipment: null, carrierStaleDays: STALE })).toBe("BLOCK");
  });

  it("NEEDS_CARRIER_CHECK for a fresh PENDING/MANIFESTED shipment", () => {
    for (const status of ["PENDING", "MANIFESTED"] as const) {
      expect(
        evaluateDealerGateLocal({ orderStatus: "PROCESSING", shipment: { status, ageDays: 0.5 }, carrierStaleDays: STALE })
      ).toBe("NEEDS_CARRIER_CHECK");
    }
  });

  it("BLOCKs locally when the shipment status is already past pickup — no fetch needed", () => {
    for (const status of ["PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED", "RETURNED"] as const) {
      expect(
        evaluateDealerGateLocal({ orderStatus: "PROCESSING", shipment: { status, ageDays: 0.1 }, carrierStaleDays: STALE })
      ).toBe("BLOCK");
    }
  });

  it("BLOCKs via the age backstop once a MANIFESTED shipment is older than carrierStaleDays", () => {
    expect(
      evaluateDealerGateLocal({ orderStatus: "PROCESSING", shipment: { status: "MANIFESTED", ageDays: 3.01 }, carrierStaleDays: STALE })
    ).toBe("BLOCK");
    // exactly at the threshold still needs the check
    expect(
      evaluateDealerGateLocal({ orderStatus: "PROCESSING", shipment: { status: "MANIFESTED", ageDays: 3 }, carrierStaleDays: STALE })
    ).toBe("NEEDS_CARRIER_CHECK");
  });
});

describe("resolveDealerGateFromCarrier — fail closed", () => {
  it("ALLOWs only PRE_SHIP; blocks POST_SHIP and FETCH_FAILED", () => {
    expect(resolveDealerGateFromCarrier("PRE_SHIP")).toBe("ALLOW");
    expect(resolveDealerGateFromCarrier("POST_SHIP")).toBe("BLOCK");
    expect(resolveDealerGateFromCarrier("FETCH_FAILED")).toBe("BLOCK");
  });
});

describe("defaultAdminStageFromCarrier — tier defaulted from raw carrier data, not Order.status", () => {
  it("uses the carrier tier when a shipment exists", () => {
    expect(defaultAdminStageFromCarrier({ hasShipment: true, carrierTier: "PRE_SHIP", orderStatusStage: "POST_SHIP" })).toBe("PRE_SHIP");
    expect(defaultAdminStageFromCarrier({ hasShipment: true, carrierTier: "POST_SHIP", orderStatusStage: "PRE_SHIP" })).toBe("POST_SHIP");
  });

  it("fails closed to POST_SHIP when the carrier fetch failed but a shipment exists", () => {
    expect(defaultAdminStageFromCarrier({ hasShipment: true, carrierTier: "FETCH_FAILED", orderStatusStage: "PRE_SHIP" })).toBe("POST_SHIP");
  });

  it("falls back to the Order.status-derived stage only when there is no shipment", () => {
    expect(defaultAdminStageFromCarrier({ hasShipment: false, carrierTier: null, orderStatusStage: "PRE_SHIP" })).toBe("PRE_SHIP");
  });
});

describe("rounding — half-up to 2 decimals", () => {
  it("rounds a ₹1,234.56 order's pre-ship charge correctly", () => {
    // 1234.56 * 2% = 24.6912 -> 24.69
    const quote = calculateCancellation({ feePercent: 2, amountPaid: 1234.56 });
    expect(quote.feeAmount).toBe(24.69);
    expect(quote.refundAmount).toBe(1209.87);
  });

  it("rounds the same order's post-ship charge correctly", () => {
    // 1234.56 * 20% = 246.912 -> 246.91
    const quote = calculateCancellation({ feePercent: 20, amountPaid: 1234.56 });
    expect(quote.feeAmount).toBe(246.91);
    expect(quote.refundAmount).toBe(987.65);
  });

  it("rounds .5-paise-and-above up, not down (half-up, not banker's rounding)", () => {
    // 837.25 * 2% = 16.745 -> 16.75 (would be 16.74 under round-half-to-even)
    const quote = calculateCancellation({ feePercent: 2, amountPaid: 837.25 });
    expect(quote.feeAmount).toBe(16.75);
  });

  it("never lets refundAmount go negative", () => {
    const quote = calculateCancellation({ feePercent: 100, amountPaid: 500 });
    expect(quote.refundAmount).toBe(0);
  });
});
