import { beforeEach, describe, expect, it, vi } from "vitest";

const vendorFindUnique = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { vendor: { findUnique: (...a: unknown[]) => vendorFindUnique(...a) } },
}));

const { getVerifiedVendor } = await import("./verified-account");

const good = {
  id: "v1",
  status: "APPROVED",
  user: { isActive: true, emailVerified: new Date(), mobileVerified: true },
};

describe("getVerifiedVendor", () => {
  beforeEach(() => vendorFindUnique.mockReset());

  it("returns an approved, active, fully verified vendor", async () => {
    vendorFindUnique.mockResolvedValue(good);
    expect(await getVerifiedVendor("u1")).toBe(good);
  });

  it.each([
    ["not approved", { ...good, status: "PENDING" }],
    ["suspended", { ...good, status: "SUSPENDED" }],
    ["deactivated user", { ...good, user: { ...good.user, isActive: false } }],
    ["email not verified", { ...good, user: { ...good.user, emailVerified: null } }],
    ["mobile not verified", { ...good, user: { ...good.user, mobileVerified: false } }],
    ["no linked user", { ...good, user: null }],
  ])("rejects a vendor that is %s", async (_label, vendor) => {
    vendorFindUnique.mockResolvedValue(vendor);
    expect(await getVerifiedVendor("u1")).toBeNull();
  });

  it("rejects when there is no vendor", async () => {
    vendorFindUnique.mockResolvedValue(null);
    expect(await getVerifiedVendor("u1")).toBeNull();
  });
});
