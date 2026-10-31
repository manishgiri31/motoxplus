import { describe, it, expect } from "vitest";
import { balancesAfterPayment } from "./balances";

describe("balancesAfterPayment", () => {
  it("FULL_100: nothing left to collect, PAID", () => {
    expect(balancesAfterPayment({ paymentType: "FULL_100", grandTotal: 5000, amountDue: 5000 })).toEqual({
      amountPaid: 5000,
      amountDue: 0,
      paymentStatus: "PAID",
    });
  });

  it("ADVANCE_20: balance = grandTotal - advance, PARTIAL (this is what ships as COD)", () => {
    expect(balancesAfterPayment({ paymentType: "ADVANCE_20", grandTotal: 5000, amountDue: 1000 })).toEqual({
      amountPaid: 1000,
      amountDue: 4000,
      paymentStatus: "PARTIAL",
    });
  });

  it("rounds the balance to paise", () => {
    const r = balancesAfterPayment({ paymentType: "ADVANCE_20", grandTotal: 1000.07, amountDue: 200.014 });
    expect(r.amountDue).toBe(800.06);
  });
});
