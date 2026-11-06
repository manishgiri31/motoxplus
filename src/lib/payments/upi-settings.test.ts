import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  buildOrderPaymentSettings,
  toUpiFormInitial,
  isNotSet,
  isUpiFlagEnabled,
  UPI_NOT_CONFIGURED_MESSAGE,
  BANK_NOT_CONFIGURED_MESSAGE,
  PAYMENT_NOT_CONFIGURED_MESSAGE,
} from "./upi-settings";

// Synthetic values only: never real account data.
const FULL = {
  upi_id: "merchant@testbank",
  upi_name: "Test Merchant Pvt Ltd",
  bank_account_name: "Test Merchant Pvt Ltd",
  bank_account_number: "000011112222",
  bank_ifsc: "TEST0000001",
  bank_account_type: "Current",
};

describe("isUpiFlagEnabled (the single opt-in rule shared by checkout, admin settings and the order route)", () => {
  it("is on only for the exact string \"true\"", () => {
    expect(isUpiFlagEnabled({ upi_enabled: "true" })).toBe(true);
  });
  it.each([undefined, "false", "", " true", "TRUE", "yes", "1"])("is off for %j", (v) => {
    expect(isUpiFlagEnabled(v === undefined ? {} : { upi_enabled: v })).toBe(false);
  });
});

describe("buildOrderPaymentSettings", () => {
  it("fully configured: returns stored values, UPI on, no messages", () => {
    const s = buildOrderPaymentSettings(FULL, true);
    expect(s).toEqual({
      upiId: "merchant@testbank",
      upiName: "Test Merchant Pvt Ltd",
      bankAccountName: "Test Merchant Pvt Ltd",
      bankAccountNumber: "000011112222",
      bankIfsc: "TEST0000001",
      upiEnabled: true,
      upiMessage: null,
      bankMessage: null,
      message: null,
    });
  });

  it("nothing configured: every value null, UPI off, a message the page can show, no invented defaults", () => {
    const s = buildOrderPaymentSettings({}, true);
    expect(s.upiId).toBeNull();
    expect(s.upiName).toBeNull();
    expect(s.bankAccountName).toBeNull();
    expect(s.bankAccountNumber).toBeNull();
    expect(s.bankIfsc).toBeNull();
    expect(s.upiEnabled).toBe(false);
    expect(s.upiMessage).toBe(UPI_NOT_CONFIGURED_MESSAGE);
    expect(s.bankMessage).toBe(BANK_NOT_CONFIGURED_MESSAGE);
    expect(s.message).toBe(PAYMENT_NOT_CONFIGURED_MESSAGE);
  });

  it("UPI switched on but VPA missing: UPI off with a message, bank transfer still offered", () => {
    const { upi_id: _a, upi_name: _b, ...bankOnly } = FULL;
    const s = buildOrderPaymentSettings(bankOnly, true);
    expect(s.upiEnabled).toBe(false);
    expect(s.upiMessage).toBe(UPI_NOT_CONFIGURED_MESSAGE);
    expect(s.bankMessage).toBeNull();
    expect(s.message).toBeNull(); // bank still usable, so the page keeps working
    expect(s.bankAccountNumber).toBe("000011112222");
  });

  it("only one of upi_id / upi_name set counts as not configured", () => {
    expect(buildOrderPaymentSettings({ ...FULL, upi_name: "" }, true).upiEnabled).toBe(false);
    expect(buildOrderPaymentSettings({ ...FULL, upi_id: "" }, true).upiEnabled).toBe(false);
  });

  it("UPI switched off by the flag: no UPI message (intentional), bank still offered", () => {
    const s = buildOrderPaymentSettings(FULL, false);
    expect(s.upiEnabled).toBe(false);
    expect(s.upiMessage).toBeNull();
    expect(s.message).toBeNull();
  });

  it("bank incomplete (any of name / number / IFSC missing): bankMessage set, no partial details leaked as complete", () => {
    for (const key of ["bank_account_name", "bank_account_number", "bank_ifsc"] as const) {
      const s = buildOrderPaymentSettings({ ...FULL, [key]: "" }, true);
      expect(s.bankMessage).toBe(BANK_NOT_CONFIGURED_MESSAGE);
      expect(s.upiEnabled).toBe(true);
      expect(s.message).toBeNull(); // UPI still works
    }
  });

  it("flag off AND bank missing: neither method is available, so `message` is set", () => {
    const s = buildOrderPaymentSettings({ upi_id: FULL.upi_id, upi_name: FULL.upi_name }, false);
    expect(s.upiEnabled).toBe(false);
    expect(s.message).toBe(PAYMENT_NOT_CONFIGURED_MESSAGE);
  });

  it("treats whitespace-only values as not set and trims stored ones", () => {
    const s = buildOrderPaymentSettings({ ...FULL, upi_id: "   ", bank_ifsc: "  TEST0000001 " }, true);
    expect(s.upiId).toBeNull();
    expect(s.upiEnabled).toBe(false);
    expect(s.bankIfsc).toBe("TEST0000001");
  });

  it("does not interpret the upi_enabled flag itself: the caller's decision wins", () => {
    expect(buildOrderPaymentSettings({ ...FULL, upi_enabled: "false" }, true).upiEnabled).toBe(true);
    expect(buildOrderPaymentSettings({ ...FULL, upi_enabled: "true" }, false).upiEnabled).toBe(false);
  });
});

describe("toUpiFormInitial (admin settings)", () => {
  it("returns stored values as-is", () => {
    expect(toUpiFormInitial(FULL, true)).toEqual({
      upiId: "merchant@testbank",
      upiName: "Test Merchant Pvt Ltd",
      upiEnabled: true,
      bankAccountName: "Test Merchant Pvt Ltd",
      bankAccountNumber: "000011112222",
      bankIfsc: "TEST0000001",
      bankAccountType: "Current",
    });
  });

  it("missing values are empty strings, never a default", () => {
    const f = toUpiFormInitial({}, true);
    for (const k of ["upiId", "upiName", "bankAccountName", "bankAccountNumber", "bankIfsc", "bankAccountType"] as const) {
      expect(f[k]).toBe("");
    }
  });

  it("isNotSet drives the 'Not set' warning for empty and whitespace-only values", () => {
    expect(isNotSet("")).toBe(true);
    expect(isNotSet("   ")).toBe(true);
    expect(isNotSet(undefined)).toBe(true);
    expect(isNotSet("x")).toBe(false);
  });
});

describe("no hard-coded payee or bank values in the touched sources", () => {
  const root = path.resolve(__dirname, "../../..");
  const files = [
    "src/lib/payments/upi-settings.ts",
    "src/app/api/payments/upi/[orderId]/route.ts",
    "src/app/admin/settings/page.tsx",
    "src/components/admin/upi-settings-form.tsx",
    "src/app/api/admin/settings/upi/route.ts",
  ];
  it.each(files)("%s", (f) => {
    const src = readFileSync(path.join(root, f), "utf8");
    expect(src).not.toMatch(/["'`][\w.-]+@[a-z]{3,}["'`]/i); // "name@bank"
    expect(src).not.toMatch(/\b[A-Z]{4}0[A-Z0-9]{6}\b/); // IFSC
    expect(src).not.toMatch(/["'`]\d{9,18}["'`]/); // account-number literal
    expect(src).not.toMatch(/MotoXPlus India Private Limited/);
  });
});
