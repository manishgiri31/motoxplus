import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";

// GET /api/admin/settings/upi is PUBLIC (the dealer checkout calls it with no
// session). It must never leak bank-account details or a hard-coded payee.

const findManyMock = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { setting: { findMany: (...a: unknown[]) => findManyMock(...a) }, $transaction: vi.fn() },
}));
vi.mock("@/lib/auth/rate-limit-budgets", () => ({ enforceRateLimit: vi.fn().mockResolvedValue(null) }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

import { GET } from "./route";

// The complete set of keys the public response may ever contain.
const ALLOWED_KEYS_OK = ["upiEnabled"];
const ALLOWED_KEYS_ERROR = ["error", "upiEnabled"];

// Values that must never appear anywhere in a public response, even if they are
// present in the Setting table. Synthetic test values, not real account data.
const SECRETS = {
  upi_id: "merchant@testbank",
  upi_name: "Test Merchant Pvt Ltd",
  bank_account_name: "Test Merchant Pvt Ltd",
  bank_account_number: "000011112222",
  bank_ifsc: "TEST0000001",
  bank_account_type: "Current",
};

function seed(rows: Record<string, string>) {
  // Honour the key filter like Prisma would, so a query that asks for bank keys
  // would be served them and the leak would be caught.
  findManyMock.mockImplementation(async (args: { where: { key: { in: string[] } } }) =>
    Object.entries(rows)
      .filter(([key]) => args.where.key.in.includes(key))
      .map(([key, value]) => ({ key, value }))
  );
}

const call = async () => {
  const res = await GET(new NextRequest("http://localhost/api/admin/settings/upi"));
  return { status: res.status, body: await res.json() };
};

beforeEach(() => {
  findManyMock.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("route source", () => {
  it("contains no hard-coded payee: no UPI handle, IFSC-shaped code or bank-account-length number", () => {
    const src = readFileSync(path.join(__dirname, "route.ts"), "utf8");
    expect(src).not.toMatch(/["'`][\w.-]+@[a-z]{3,}["'`]/i); // "name@bank" string literal
    expect(src).not.toMatch(/\b[A-Z]{4}0[A-Z0-9]{6}\b/); // IFSC
    expect(src).not.toMatch(/["'`]\d{9,18}["'`]/); // bank account number literal
  });
});

describe("GET /api/admin/settings/upi (public)", () => {
  it("returns exactly the allowed keys and no bank, IFSC, UPI id or name when fully configured", async () => {
    seed({ upi_enabled: "true", ...SECRETS });
    const { status, body } = await call();
    expect(status).toBe(200);
    expect(Object.keys(body).sort()).toEqual(ALLOWED_KEYS_OK);
    expect(body).toEqual({ upiEnabled: true });
    const serialized = JSON.stringify(body);
    for (const v of Object.values(SECRETS)) expect(serialized).not.toContain(v);
    for (const k of Object.keys(body)) expect(k).not.toMatch(/bank|ifsc|account|upiId|upiName/i);
  });

  it("never asks the database for bank fields", async () => {
    seed({ upi_enabled: "true", ...SECRETS });
    await call();
    const asked: string[] = findManyMock.mock.calls[0][0].where.key.in;
    expect(asked.filter((k) => /bank|ifsc/i.test(k))).toEqual([]);
  });

  it("is disabled, with no payee data, when nothing is configured (no real-looking defaults)", async () => {
    seed({});
    const { status, body } = await call();
    expect(status).toBe(200);
    expect(body).toEqual({ upiEnabled: false });
    expect(Object.keys(body).sort()).toEqual(ALLOWED_KEYS_OK);
  });

  it("stays disabled when upi_enabled is not exactly 'true'", async () => {
    seed({ upi_enabled: "false", ...SECRETS });
    expect((await call()).body).toEqual({ upiEnabled: false });
    seed({ upi_enabled: "yes", ...SECRETS });
    expect((await call()).body).toEqual({ upiEnabled: false });
  });

  it("fails closed with 503 when enabled but the VPA is missing, without inventing one", async () => {
    seed({ upi_enabled: "true", bank_account_number: SECRETS.bank_account_number, bank_ifsc: SECRETS.bank_ifsc });
    const { status, body } = await call();
    expect(status).toBe(503);
    expect(Object.keys(body).sort()).toEqual(ALLOWED_KEYS_ERROR);
    expect(body.upiEnabled).toBe(false);
    expect(body.error).toMatch(/not configured/i);
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain(SECRETS.bank_account_number);
    expect(serialized).not.toContain(SECRETS.bank_ifsc);
  });

  it("fails closed with 503 when only one of upi_id / upi_name is set", async () => {
    seed({ upi_enabled: "true", upi_id: SECRETS.upi_id });
    expect((await call()).status).toBe(503);
    seed({ upi_enabled: "true", upi_name: SECRETS.upi_name });
    expect((await call()).status).toBe(503);
  });
});
