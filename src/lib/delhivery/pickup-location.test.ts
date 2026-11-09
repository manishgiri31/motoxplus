import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

const { resolveCheckoutPickup, resolveShipmentOrigin } = await import("./pickup-location");

type Row = {
  ownerType: "MOTOXPLUS" | "VENDOR";
  vendorId: string | null;
  delhiveryName: string;
  status: "PENDING" | "ACTIVE" | "FAILED";
};

let rows: Row[] = [];
const findMany = vi.fn(async () => rows);
const findUnique = vi.fn();
const db = { delhiveryWarehouse: { findMany, findUnique } } as never;

const own = (productId: string, source = "MOTOXPLUS", vendorId: string | null = null) => ({ productId, product: { source, vendorId } });
const vendor = (productId: string, vendorId: string) => ({ productId, product: { source: "VENDOR", vendorId } });
const wh = (vendorId: string, status: Row["status"] = "ACTIVE"): Row => ({
  ownerType: "VENDOR",
  vendorId,
  delhiveryName: `VND-${vendorId.toUpperCase()}-110020`,
  status,
});

beforeEach(() => {
  vi.clearAllMocks();
  rows = [];
});

describe("resolveCheckoutPickup", () => {
  it("MotoXPlus's own products keep shipping from the configured location (null) when there is no MOTOXPLUS row", async () => {
    expect(await resolveCheckoutPickup("B2C", [own("p1"), own("p2")], db)).toEqual({ ok: true, pickupLocationName: null });
    expect(await resolveCheckoutPickup("B2B", [own("p1")], db)).toEqual({ ok: true, pickupLocationName: null });
  });

  it("uses the MOTOXPLUS warehouse row for own products once it is ACTIVE, and blocks while it is not", async () => {
    rows = [{ ownerType: "MOTOXPLUS", vendorId: null, delhiveryName: "Manish Giri", status: "ACTIVE" }];
    expect(await resolveCheckoutPickup("B2C", [own("p1")], db)).toEqual({ ok: true, pickupLocationName: "Manish Giri" });

    rows = [{ ownerType: "MOTOXPLUS", vendorId: null, delhiveryName: "Manish Giri", status: "PENDING" }];
    expect(await resolveCheckoutPickup("B2C", [own("p1")], db)).toMatchObject({ ok: false, code: "WAREHOUSE_NOT_ACTIVE" });
  });

  it("imported/procured stock that carries a supplier vendorId is still MotoXPlus's own", async () => {
    expect(await resolveCheckoutPickup("B2C", [own("p1", "EAUTO_IMPORT", "supplier-1")], db)).toEqual({
      ok: true,
      pickupLocationName: null,
    });
  });

  it("a vendor's product ships from that vendor's ACTIVE warehouse", async () => {
    rows = [wh("v1")];
    expect(await resolveCheckoutPickup("B2C", [vendor("p1", "v1"), vendor("p2", "v1")], db)).toEqual({
      ok: true,
      pickupLocationName: "VND-V1-110020",
    });
  });

  it.each(["PENDING", "FAILED"] as const)("blocks checkout while the vendor's warehouse is %s", async (status) => {
    rows = [wh("v1", status)];
    expect(await resolveCheckoutPickup("B2C", [vendor("p1", "v1")], db)).toEqual({
      ok: false,
      code: "WAREHOUSE_NOT_ACTIVE",
      error: expect.any(String),
      productIds: ["p1"],
    });
  });

  it("blocks checkout when the vendor has no warehouse at all", async () => {
    expect(await resolveCheckoutPickup("B2C", [own("p0"), vendor("p1", "v1")], db)).toMatchObject({
      ok: false,
      code: "WAREHOUSE_NOT_ACTIVE",
      productIds: ["p1"],
    });
  });

  it("refuses a cart that would need two pickups, naming the smaller group to remove", async () => {
    rows = [wh("v1"), wh("v2")];
    expect(await resolveCheckoutPickup("B2C", [own("p1"), own("p2"), vendor("p3", "v1")], db)).toMatchObject({
      ok: false,
      code: "MIXED_WAREHOUSES",
      productIds: ["p3"],
    });
    expect(await resolveCheckoutPickup("B2C", [vendor("p1", "v1"), vendor("p2", "v2"), vendor("p3", "v2")], db)).toMatchObject({
      ok: false,
      code: "MIXED_WAREHOUSES",
      productIds: ["p1"],
    });
  });

  it("dealer (B2B) orders cannot include vendor products: their warehouses exist only on the B2C client", async () => {
    rows = [wh("v1")];
    expect(await resolveCheckoutPickup("B2B", [own("p1"), vendor("p2", "v1")], db)).toMatchObject({
      ok: false,
      code: "VENDOR_B2B_UNSUPPORTED",
      productIds: ["p2"],
    });
    expect(findMany).not.toHaveBeenCalled();
  });
});

describe("resolveShipmentOrigin", () => {
  const configured = () => "Manish Giri";

  it("null (legacy orders / own products) means the configured location", async () => {
    expect(await resolveShipmentOrigin(null, configured, db)).toBeNull();
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("an ACTIVE vendor warehouse is the pickup and the return address", async () => {
    findUnique.mockResolvedValue({
      delhiveryName: "VND-VND12345678-110020",
      status: "ACTIVE",
      address: "Plot 4, Okhla",
      city: "New Delhi",
      state: "Delhi",
      pin: "110020",
      phone: "9876543210",
      returnAddress: "Shed 9, Narela",
      returnCity: "Delhi",
      returnState: "Delhi",
      returnPin: "110040",
      vendor: { companyName: "Kumar Auto Components" },
    });
    expect(await resolveShipmentOrigin("VND-VND12345678-110020", configured, db)).toEqual({
      locationName: "VND-VND12345678-110020",
      address: "Plot 4, Okhla",
      city: "New Delhi",
      state: "Delhi",
      pin: "110020",
      phone: "9876543210",
      returnName: "Kumar Auto Components",
      returnAddress: "Shed 9, Narela",
      returnCity: "Delhi",
      returnState: "Delhi",
      returnPin: "110040",
    });
  });

  it("never books from a warehouse that is no longer ACTIVE or that we don't know", async () => {
    findUnique.mockResolvedValue({ delhiveryName: "VND-X-110020", status: "FAILED" });
    await expect(resolveShipmentOrigin("VND-X-110020", configured, db)).rejects.toThrow(/not ACTIVE/);

    findUnique.mockResolvedValue(null);
    await expect(resolveShipmentOrigin("SOMEWHERE-ELSE", configured, db)).rejects.toThrow(/not a known warehouse/);
    expect(await resolveShipmentOrigin("Manish Giri", configured, db)).toBeNull();
  });
});
