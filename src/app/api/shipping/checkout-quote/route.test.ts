import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// The checkout page shows POST /api/shipping/checkout-quote; the customer is charged by POST /api/orders.
// These tests run BOTH handlers against the same cart and the same Delhivery rate and require the same numbers.

const db = vi.hoisted(() => ({
  cartItems: [] as Record<string, unknown>[],
  orders: [] as Record<string, unknown>[],
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    cart: {
      findUnique: async () => ({ id: "cart_1", schemeId: null, items: [...db.cartItems] }),
    },
    cartItem: { deleteMany: async () => ({ count: 0 }) },
    customer: { update: async () => ({}) },
    delhiveryWarehouse: {
      findFirst: async ({ where }: { where: { delhiveryName: string } }) =>
        where.delhiveryName === "MOTOXPLUS-MAIN" ? { pin: "110045" } : null,
    },
    order: {
      findFirst: async () => null,
      findUnique: async ({ where }: { where: { id: string } }) => db.orders.find((o) => o.id === where.id) ?? null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const order = { id: `order_${db.orders.length + 1}`, ...data };
        db.orders.push(order);
        return order;
      },
    },
  },
}));
vi.mock("@/lib/auth/current-user", () => ({ getCurrentUserId: vi.fn().mockResolvedValue("user_1") }));
vi.mock("@/lib/auth/verified-account", () => ({
  ACCOUNT_NOT_VERIFIED_MESSAGE: "not verified",
  resolveOrderActor: vi.fn().mockResolvedValue({ channel: "B2C", customer: { id: "cust_1" } }),
}));
vi.mock("@/lib/auth/rate-limit-budgets", () => ({
  enforceRateLimit: vi.fn().mockResolvedValue(null),
  rejectOversizedBody: vi.fn().mockReturnValue(null),
}));
vi.mock("@/lib/delhivery/pickup-location", () => ({
  resolveCheckoutPickup: vi.fn().mockResolvedValue({ ok: true, pickupLocationName: "MOTOXPLUS-MAIN" }),
}));
vi.mock("@/lib/delhivery/rates", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/delhivery/rates")>()),
  calculateShippingRate: vi.fn(),
}));
vi.mock("@/lib/tax/seller-state", () => ({ getSellerState: vi.fn().mockResolvedValue("Delhi") }));
vi.mock("@/lib/orders/cod", () => ({
  confirmCodOrder: vi.fn(),
  isCodAvailable: vi.fn().mockResolvedValue(true),
  COD_UNAVAILABLE_MESSAGE: "cod unavailable",
}));
vi.mock("@/lib/schemes/cart-validation", () => ({ validateSchemeSelection: vi.fn() }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

import { POST as quotePOST } from "./route";
import { POST as ordersPOST } from "@/app/api/orders/route";
import { calculateShippingRate } from "@/lib/delhivery/rates";
import { resolveOrderActor } from "@/lib/auth/verified-account";

const rate = vi.mocked(calculateShippingRate);

function cartLine(mrp: number, quantity: number) {
  return {
    productId: "prod_1",
    variantId: null,
    variant: null,
    quantity,
    product: {
      isActive: true,
      stockStatus: "IN_STOCK",
      mrp,
      price: mrp * 0.7,
      gstRate: 18,
      source: "MOTOXPLUS",
      vendorId: null,
      weight: 1.5,
      packageWeight: null,
    },
  };
}

const post = (handler: (req: NextRequest) => Promise<Response>, url: string, body: unknown) =>
  handler(
    new NextRequest(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
  );

const quote = (body: unknown) => post(quotePOST, "http://localhost/api/shipping/checkout-quote", body);

async function placeOrder(paymentType: "FULL_100" | "COD") {
  const res = await post(ordersPOST, "http://localhost/api/orders", {
    paymentType,
    deliveryName: "A Customer",
    deliveryPhone: "9999999999",
    deliveryAddress: "1 Test Road",
    deliveryCity: "Yamuna Nagar",
    deliveryState: "Haryana",
    deliveryPincode: "135001",
  });
  return { status: res.status, json: await res.json() };
}

beforeEach(() => {
  vi.clearAllMocks();
  db.orders = [];
  db.cartItems = [cartLine(1180, 2)];
  rate.mockResolvedValue({ shippingCost: 92, source: "delhivery_api" });
});

describe("POST /api/shipping/checkout-quote", () => {
  it("returns the real rate, and the order is charged exactly what was shown", async () => {
    const res = await quote({ deliveryPincode: "135001", paymentMode: "Prepaid" });
    expect(res.status).toBe(200);
    const shown = await res.json();
    expect(shown).toEqual({
      orderTotal: 2360,
      shippingCost: 92,
      grandTotal: 2452,
      freeDelivery: false,
      source: "delhivery_api",
    });
    expect(rate).toHaveBeenCalledWith(expect.objectContaining({ originPincode: "110045", destinationPincode: "135001" }));

    const placed = await placeOrder("FULL_100");
    expect(placed.status).toBe(200);
    expect(placed.json.order).toMatchObject({ shippingCost: shown.shippingCost, grandTotal: shown.grandTotal });
  });

  it("COD quote matches the COD order", async () => {
    rate.mockImplementation(async (input) => ({ shippingCost: input.paymentMode === "COD" ? 140 : 92, source: "delhivery_api" }));
    const shown = await (await quote({ deliveryPincode: "135001", paymentMode: "COD" })).json();
    expect(shown.shippingCost).toBe(140);

    const placed = await placeOrder("COD");
    expect(placed.json.order).toMatchObject({ shippingCost: 140, grandTotal: shown.grandTotal });
  });

  it("is free at ₹25,000 incl. GST — shown and charged", async () => {
    db.cartItems = [cartLine(12500, 2)];
    const shown = await (await quote({ deliveryPincode: "135001" })).json();
    expect(shown).toEqual({ orderTotal: 25000, shippingCost: 0, grandTotal: 25000, freeDelivery: true, source: "free" });
    expect(rate).not.toHaveBeenCalled();

    const placed = await placeOrder("FULL_100");
    expect(placed.json.order).toMatchObject({ shippingCost: 0, grandTotal: 25000 });
  });

  it("returns 503 (not ₹100) when only the default rate is available — and the order is refused the same way", async () => {
    rate.mockResolvedValue({ shippingCost: 100, source: "default" });
    const res = await quote({ deliveryPincode: "135001" });
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ code: "SHIPPING_RATE_UNAVAILABLE" });

    const placed = await placeOrder("FULL_100");
    expect(placed.status).toBe(503);
    expect(placed.json.code).toBe("SHIPPING_RATE_UNAVAILABLE");
    expect(db.orders).toHaveLength(0);
  });

  it("validates the pincode and payment mode", async () => {
    expect((await quote({ deliveryPincode: "13500" })).status).toBe(400);
    expect((await quote({ deliveryPincode: "135001", paymentMode: "UPI" })).status).toBe(400);
  });

  it("is for customer (B2C) accounts only", async () => {
    vi.mocked(resolveOrderActor).mockResolvedValueOnce({ channel: "B2B", dealer: { id: "dealer_1" } } as never);
    expect((await quote({ deliveryPincode: "135001" })).status).toBe(403);
  });
});
