import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const validatePartCategoryIds = vi.fn();
const userCreate = vi.fn();
const findUnique = vi.fn();

vi.mock("@/lib/catalog/part-categories", () => ({ validatePartCategoryIds: (...a: unknown[]) => validatePartCategoryIds(...a) }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: (...a: unknown[]) => findUnique(...a), create: (...a: unknown[]) => userCreate(...a) },
    vendor: { findUnique: (...a: unknown[]) => findUnique(...a) },
  },
}));
vi.mock("@/lib/utils", () => ({ generateVendorCode: async () => "VND-0001" }));
vi.mock("@/lib/auth/otp", () => ({ createOTP: async () => "123456" }));
vi.mock("@/lib/email", () => ({ sendEmail: async () => undefined, verifyEmailTemplate: () => "", welcomeTemplate: () => "" }));
vi.mock("@/lib/crypto/encryption", () => ({ encrypt: (s: string) => `enc:${s}` }));
vi.mock("@/lib/auth/rate-limit", () => ({ checkIPRateLimit: async () => true }));
vi.mock("@/lib/auth/middleware", () => ({ getClientIP: () => "127.0.0.1" }));
vi.mock("bcryptjs", () => ({ default: { hash: async () => "hashed" } }));

const { POST } = await import("./route");

const body = (over: Record<string, unknown> = {}) => ({
  companyName: "Kumar Auto Parts", ownerName: "Ravi Kumar", email: "Ravi@Example.com", phone: "9876543210",
  password: "long-enough-1", state: "Maharashtra", city: "Pune",
  categoryIds: ["g-brake", "mudguards"], vehicleSegments: ["MOTORCYCLE", "SCOOTER", "MOTORCYCLE"],
  ...over,
});
const post = (b: unknown) =>
  POST(new NextRequest("http://localhost/api/vendor/register", { method: "POST", body: JSON.stringify(b), headers: { "Content-Type": "application/json" } }));

describe("POST /api/vendor/register — automotive part categories", () => {
  beforeEach(() => {
    validatePartCategoryIds.mockReset().mockResolvedValue({ ok: true, ids: ["g-brake", "mudguards"] });
    userCreate.mockReset().mockResolvedValue({ id: "u1", email: "ravi@example.com", name: "Ravi Kumar" });
    findUnique.mockReset().mockResolvedValue(null);
  });

  it("stores the validated category ids as link rows and de-duplicated vehicle segments", async () => {
    const res = await post(body());
    expect(res.status).toBe(200);
    expect(validatePartCategoryIds).toHaveBeenCalledWith(["g-brake", "mudguards"]);
    const vendor = userCreate.mock.calls[0][0].data.vendor.create;
    expect(vendor.partCategories).toEqual({ create: [{ categoryId: "g-brake" }, { categoryId: "mudguards" }] });
    expect(vendor.vehicleSegments).toEqual(["MOTORCYCLE", "SCOOTER"]);
    expect(vendor).not.toHaveProperty("category"); // the legacy enum is no longer written
  });

  it("rejects ids the live catalogue does not accept, naming the field", async () => {
    validatePartCategoryIds.mockResolvedValue({ ok: false, error: "One or more selected categories are no longer available." });
    const res = await post(body());
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ field: "categoryIds" });
    expect(userCreate).not.toHaveBeenCalled();
  });

  it("requires at least one category and one valid vehicle segment", async () => {
    expect((await post(body({ categoryIds: [] }))).status).toBe(400);
    expect((await post(body({ vehicleSegments: [] }))).status).toBe(400);
    expect((await post(body({ vehicleSegments: ["BICYCLE"] }))).status).toBe(400);
    expect(userCreate).not.toHaveBeenCalled();
  });

  it("no longer accepts the old free-standing supply category alone", async () => {
    const { categoryIds: _c, vehicleSegments: _v, ...old } = body();
    expect((await post({ ...old, category: "PACKAGING" })).status).toBe(400);
  });
});
