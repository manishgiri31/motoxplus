import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// GET /api/payments/upi/[orderId] must never invent a payee or bank account.
// When something is not configured it answers 200 with null values and a
// message the pay-upi pages show (it used to fall back to hard-coded values).

const { getCurrentUserIdMock, settingFindManyMock, prismaMock } = vi.hoisted(() => {
  const settingFindManyMock = vi.fn();
  return {
    getCurrentUserIdMock: vi.fn(),
    settingFindManyMock,
    prismaMock: {
      user: { findUnique: vi.fn() },
      dealer: { findUnique: vi.fn() },
      customer: { findUnique: vi.fn() },
      order: { findFirst: vi.fn() },
      setting: { findMany: (...a: unknown[]) => settingFindManyMock(...a) },
    },
  };
});
vi.mock("@/lib/auth/current-user", () => ({ getCurrentUserId: (...a: unknown[]) => getCurrentUserIdMock(...a) }));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { GET } from "./route";

const FULL = {
  upi_enabled: "true", // opt-in: UPI is only offered when explicitly switched on
  upi_id: "merchant@testbank",
  upi_name: "Test Merchant Pvt Ltd",
  bank_account_name: "Test Merchant Pvt Ltd",
  bank_account_number: "000011112222",
  bank_ifsc: "TEST0000001",
};

function seed(rows: Record<string, string>) {
  settingFindManyMock.mockImplementation(async (args: { where: { key: { in: string[] } } }) =>
    Object.entries(rows)
      .filter(([key]) => args.where.key.in.includes(key))
      .map(([key, value]) => ({ key, value }))
  );
}

async function call() {
  const res = await GET(new NextRequest("http://localhost/api/payments/upi/order_1"), {
    params: Promise.resolve({ orderId: "order_1" }),
  });
  return { status: res.status, body: await res.json() };
}

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentUserIdMock.mockResolvedValue("user_1");
  prismaMock.user.findUnique.mockResolvedValue({ role: "DEALER" });
  prismaMock.dealer.findUnique.mockResolvedValue({ id: "dealer_1" });
  prismaMock.order.findFirst.mockResolvedValue({ id: "order_1", orderNumber: "MX-1" });
});

describe("GET /api/payments/upi/[orderId] payment settings", () => {
  it("configured: returns the stored values with UPI enabled and no messages", async () => {
    seed(FULL);
    const { status, body } = await call();
    expect(status).toBe(200);
    expect(body.paymentSettings).toMatchObject({
      upiId: "merchant@testbank",
      upiName: "Test Merchant Pvt Ltd",
      bankAccountNumber: "000011112222",
      bankIfsc: "TEST0000001",
      bankAccountName: "Test Merchant Pvt Ltd",
      upiEnabled: true,
      upiMessage: null,
      bankMessage: null,
      message: null,
    });
  });

  it("UPI not configured: 200, upiEnabled false, a message, and no VPA", async () => {
    seed({ upi_enabled: "true", bank_account_name: FULL.bank_account_name, bank_account_number: FULL.bank_account_number, bank_ifsc: FULL.bank_ifsc });
    const { status, body } = await call();
    expect(status).toBe(200);
    expect(body.paymentSettings.upiEnabled).toBe(false);
    expect(body.paymentSettings.upiId).toBeNull();
    expect(body.paymentSettings.upiMessage).toMatch(/isn't available/i);
    expect(body.paymentSettings.message).toBeNull(); // bank still usable
    expect(body.order.id).toBe("order_1"); // order data is still returned
  });

  it("nothing configured: 200 with all-null values and a top-level message, no real-looking defaults", async () => {
    seed({});
    const { status, body } = await call();
    expect(status).toBe(200);
    const s = body.paymentSettings;
    expect([s.upiId, s.upiName, s.bankAccountName, s.bankAccountNumber, s.bankIfsc]).toEqual([null, null, null, null, null]);
    expect(s.upiEnabled).toBe(false);
    expect(s.message).toMatch(/haven't been set up/i);
    expect(JSON.stringify(body.paymentSettings)).not.toMatch(/\d{9,}/);
  });

  it("bank incomplete: bankMessage set, UPI unaffected", async () => {
    seed({ upi_enabled: "true", upi_id: FULL.upi_id, upi_name: FULL.upi_name, bank_account_name: FULL.bank_account_name });
    const { body } = await call();
    expect(body.paymentSettings.upiEnabled).toBe(true);
    expect(body.paymentSettings.bankMessage).toMatch(/bank transfer details/i);
    expect(body.paymentSettings.bankAccountNumber).toBeNull();
    expect(body.paymentSettings.message).toBeNull();
  });

  it("explicitly switched off (upi_enabled=false): UPI off without a 'not configured' message", async () => {
    seed({ ...FULL, upi_enabled: "false" });
    const { body } = await call();
    expect(body.paymentSettings.upiEnabled).toBe(false);
    expect(body.paymentSettings.upiMessage).toBeNull();
    expect(body.paymentSettings.bankMessage).toBeNull();
  });

  it("upi_enabled is opt-in: with no flag row UPI is off even if fully configured, bank transfer still offered", async () => {
    const { upi_enabled: _omit, ...withoutFlag } = FULL;
    seed(withoutFlag);
    const { status, body } = await call();
    expect(status).toBe(200);
    expect(body.paymentSettings.upiEnabled).toBe(false);
    expect(body.paymentSettings.upiMessage).toBeNull(); // off by choice, not a misconfiguration
    expect(body.paymentSettings.bankMessage).toBeNull();
    expect(body.paymentSettings.message).toBeNull();
  });

  it.each(["yes", "TRUE", "1", " true", ""])("upi_enabled=%j is not exactly \"true\": UPI stays off", async (value) => {
    seed({ ...FULL, upi_enabled: value });
    expect((await call()).body.paymentSettings.upiEnabled).toBe(false);
  });

  it("still requires login (unchanged): 401 and no settings read", async () => {
    getCurrentUserIdMock.mockResolvedValue(null);
    const { status } = await call();
    expect(status).toBe(401);
    expect(settingFindManyMock).not.toHaveBeenCalled();
  });
});
