import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const db = vi.hoisted(() => ({ warehouses: [] as Array<{ delhiveryName: string; pin: string }> }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    delhiveryWarehouse: {
      findFirst: vi.fn(async ({ where }: { where: { delhiveryName: string } }) => {
        const w = db.warehouses.find((x) => x.delhiveryName === where.delhiveryName);
        return w ? { pin: w.pin } : null;
      }),
    },
  },
}));
vi.mock("@/lib/delhivery/rates", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/delhivery/rates")>()),
  calculateShippingRate: vi.fn(),
}));
vi.mock("@/lib/delhivery/pickup-location", () => ({ resolveCheckoutPickup: vi.fn() }));

import { priceB2CCart, quoteB2CShipping, type B2CCartLine } from "./b2c-checkout";
import { FREE_DELIVERY_THRESHOLD } from "./quote";
import { calculateShippingRate } from "@/lib/delhivery/rates";
import { resolveCheckoutPickup } from "@/lib/delhivery/pickup-location";

const rate = vi.mocked(calculateShippingRate);
const pickup = vi.mocked(resolveCheckoutPickup);

function line(overrides: Partial<B2CCartLine["product"]> = {}, quantity = 1): B2CCartLine {
  return {
    productId: "prod_1",
    variantId: null,
    quantity,
    variant: null,
    product: {
      isActive: true,
      stockStatus: "IN_STOCK",
      mrp: 1180,
      price: 800,
      gstRate: 18,
      source: "MOTOXPLUS",
      vendorId: null,
      weight: 2,
      packageWeight: null,
      ...overrides,
    },
  };
}

const savedOrigin = process.env.DELHIVERY_ORIGIN_PINCODE;

beforeEach(() => {
  vi.clearAllMocks();
  db.warehouses = [{ delhiveryName: "MOTOXPLUS-MAIN", pin: "110045" }];
  process.env.DELHIVERY_ORIGIN_PINCODE = "110046";
  pickup.mockResolvedValue({ ok: true, pickupLocationName: "MOTOXPLUS-MAIN" });
  rate.mockResolvedValue({ shippingCost: 87.4, source: "delhivery_api" });
});
afterEach(() => {
  if (savedOrigin === undefined) delete process.env.DELHIVERY_ORIGIN_PINCODE;
  else process.env.DELHIVERY_ORIGIN_PINCODE = savedOrigin;
});

describe("priceB2CCart", () => {
  it("prices at MRP (GST-inclusive) and reports the rounded order total", () => {
    const priced = priceB2CCart([line({}, 2)]);
    expect(priced.ok).toBe(true);
    if (!priced.ok) return;
    expect(priced.orderTotal).toBeCloseTo(2360, 2);
    expect(priced.items[0].unitPrice).toBe(1180);
  });

  it("refuses inactive / out-of-stock lines", () => {
    const priced = priceB2CCart([line({ stockStatus: "OUT_OF_STOCK" })]);
    expect(priced).toMatchObject({ ok: false, status: 409, code: "ITEMS_UNAVAILABLE", productIds: ["prod_1"] });
  });

  it("refuses lines with no retail price instead of falling back to the dealer price", () => {
    const priced = priceB2CCart([line({ mrp: null })]);
    expect(priced).toMatchObject({ ok: false, status: 409, code: "ITEMS_UNPRICED", productIds: ["prod_1"] });
  });
});

describe("quoteB2CShipping", () => {
  const quote = (orderTotal: number, paymentMode: "Prepaid" | "COD" = "Prepaid") =>
    quoteB2CShipping({ lines: [line({}, 3)], orderTotal, deliveryPincode: "135001", paymentMode });

  it("is free at exactly ₹25,000 (order total incl. GST) and does not call Delhivery", async () => {
    expect(FREE_DELIVERY_THRESHOLD).toBe(25000);
    const q = await quote(25000);
    expect(q).toEqual({
      ok: true,
      pickupLocationName: "MOTOXPLUS-MAIN",
      orderTotal: 25000,
      shippingCost: 0,
      grandTotal: 25000,
      freeDelivery: true,
      source: "free",
    });
    expect(rate).not.toHaveBeenCalled();
  });

  it("charges the real Delhivery rate one paisa below the threshold, from the pickup warehouse's own pin", async () => {
    const q = await quote(24999.99);
    expect(q).toEqual({
      ok: true,
      pickupLocationName: "MOTOXPLUS-MAIN",
      orderTotal: 24999.99,
      shippingCost: 87.4,
      grandTotal: 25087.39,
      freeDelivery: false,
      source: "delhivery_api",
    });
    expect(rate).toHaveBeenCalledWith({
      originPincode: "110045", // the warehouse row, not DELHIVERY_ORIGIN_PINCODE
      destinationPincode: "135001",
      weightKg: 6, // 3 × 2 kg — calculateOrderWeight, unmocked
      paymentMode: "Prepaid",
      codAmount: 0,
    });
  });

  it("uses a DB rate slab when that is what the rate engine returned", async () => {
    rate.mockResolvedValue({ shippingCost: 120, source: "rate_slab" });
    const q = await quote(1000);
    expect(q).toMatchObject({ ok: true, shippingCost: 120, grandTotal: 1120, source: "rate_slab" });
  });

  it("never turns the ₹100 'default' fallback into a charge — it is an error", async () => {
    rate.mockResolvedValue({ shippingCost: 100, source: "default" });
    const q = await quote(1000);
    expect(q).toMatchObject({ ok: false, status: 503, code: "SHIPPING_RATE_UNAVAILABLE" });
    expect(q).not.toHaveProperty("shippingCost");
  });

  it("falls back to DELHIVERY_ORIGIN_PINCODE for the configured MotoXPlus location", async () => {
    pickup.mockResolvedValue({ ok: true, pickupLocationName: null });
    await quote(1000);
    expect(rate).toHaveBeenCalledWith(expect.objectContaining({ originPincode: "110046" }));
  });

  it("refuses to quote when no origin pin is configured (no hardcoded fallback)", async () => {
    pickup.mockResolvedValue({ ok: true, pickupLocationName: null });
    delete process.env.DELHIVERY_ORIGIN_PINCODE;
    const q = await quote(1000);
    expect(q).toMatchObject({ ok: false, status: 503, code: "SHIPPING_RATE_UNAVAILABLE" });
    expect(rate).not.toHaveBeenCalled();
  });

  it("passes COD and the order total to the rate engine for a COD order", async () => {
    await quote(1500, "COD");
    expect(rate).toHaveBeenCalledWith(expect.objectContaining({ paymentMode: "COD", codAmount: 1500 }));
  });

  it("returns the pickup error (409) for a cart that spans warehouses, even when delivery would be free", async () => {
    pickup.mockResolvedValue({ ok: false, code: "MIXED_WAREHOUSES", error: "split it", productIds: ["prod_2"] });
    const q = await quote(30000);
    expect(q).toEqual({ ok: false, status: 409, code: "MIXED_WAREHOUSES", error: "split it", productIds: ["prod_2"] });
  });
});
