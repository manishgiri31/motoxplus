import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// POST /api/orders idempotency (lib/orders/idempotency.ts). Prisma is replaced
// by an in-memory fake that enforces the same unique constraints as the
// migration (Order(dealerId, idempotencyKey), Order(customerId, idempotencyKey))
// so the replay and the concurrent-retry race are both exercised.

type FakeOrder = Record<string, unknown> & { id: string; dealerId?: string | null; customerId?: string | null; idempotencyKey?: string | null };

const db = vi.hoisted(() => ({
  orders: [] as FakeOrder[],
  cartItems: [] as Record<string, unknown>[],
  nextId: 1,
}));

function uniqueViolation() {
  return Object.assign(new Error("Unique constraint failed"), {
    code: "P2002",
    meta: { target: ["dealerId", "idempotencyKey"] },
  });
}

vi.mock("@/lib/prisma", () => {
  const orderApi = {
    findFirst: async ({ where }: { where: Record<string, unknown> }) =>
      db.orders.find((o) => Object.entries(where).every(([k, v]) => o[k] === v)) ?? null,
    findUnique: async ({ where }: { where: { id: string } }) => db.orders.find((o) => o.id === where.id) ?? null,
    create: async ({ data }: { data: Record<string, unknown> }) => {
      const key = data.idempotencyKey ?? null;
      if (key !== null) {
        const clash = db.orders.find(
          (o) =>
            o.idempotencyKey === key &&
            ((data.dealerId && o.dealerId === data.dealerId) || (data.customerId && o.customerId === data.customerId))
        );
        if (clash) throw uniqueViolation();
      }
      const { items: _items, ...scalars } = data;
      const order = { id: `order_${db.nextId++}`, ...scalars } as FakeOrder;
      db.orders.push(order);
      return order;
    },
    update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
      const o = db.orders.find((x) => x.id === where.id)!;
      Object.assign(o, data);
      return o;
    },
  };
  const cartApi = {
    findUnique: async () =>
      db.cartItems.length === 0 ? { id: "cart_1", schemeId: null, items: [] } : { id: "cart_1", schemeId: null, items: [...db.cartItems] },
    update: async () => ({}),
  };
  const cartItemApi = {
    deleteMany: async () => {
      db.cartItems = [];
      return { count: 0 };
    },
  };
  const tx = { order: orderApi, schemeRedemption: { create: async () => ({}) } };
  return {
    prisma: {
      order: orderApi,
      cart: cartApi,
      cartItem: cartItemApi,
      $transaction: async (arg: unknown) =>
        typeof arg === "function" ? (arg as (t: typeof tx) => unknown)(tx) : Promise.all(arg as Promise<unknown>[]),
    },
  };
});

vi.mock("@/lib/auth/current-user", () => ({ getCurrentUserId: vi.fn().mockResolvedValue("user_1") }));
vi.mock("@/lib/auth/verified-account", () => ({
  ACCOUNT_NOT_VERIFIED_MESSAGE: "not verified",
  resolveOrderActor: vi.fn().mockResolvedValue({
    channel: "B2B",
    dealer: { id: "dealer_1", ownerName: "Owner", phone: "9999999999", city: "Delhi", state: "Delhi" },
  }),
}));
vi.mock("@/lib/auth/rate-limit-budgets", () => ({
  enforceRateLimit: vi.fn().mockResolvedValue(null),
  rejectOversizedBody: vi.fn().mockReturnValue(null),
}));
vi.mock("@/lib/schemes/cart-validation", () => ({ validateSchemeSelection: vi.fn() }));
vi.mock("@/lib/delhivery/pickup-location", () => ({
  resolveCheckoutPickup: vi.fn().mockResolvedValue({ ok: true, pickupLocationName: null }),
}));
vi.mock("@/lib/tax/seller-state", () => ({ getSellerState: vi.fn().mockResolvedValue("Delhi") }));
// Dealer orders are priced with a live Delhivery quote (PR #8); these tests are about idempotency, not shipping.
// 2 x Rs 100 + 18% GST = 236; delivery free so the totals stay as they were.
vi.mock("@/lib/shipping/dealer-checkout", () => ({
  quoteDealerShipping: vi.fn().mockResolvedValue({
    ok: true,
    orderTotal: 236,
    shippingCost: 0,
    grandTotal: 236,
    freeDelivery: true,
    source: "free",
    pickupLocationName: null,
  }),
  dealerPaymentModeFor: (paymentType: string) => (paymentType === "ADVANCE_20" ? "COD" : "Prepaid"),
}));
vi.mock("@/lib/orders/cod", () => ({
  confirmCodOrder: vi.fn(),
  isCodAvailable: vi.fn(),
  COD_UNAVAILABLE_MESSAGE: "cod unavailable",
}));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

import { POST } from "./route";

const body = {
  paymentType: "FULL_100",
  deliveryName: "Owner",
  deliveryPhone: "9999999999",
  deliveryAddress: "1 Test Road",
  deliveryCity: "Delhi",
  deliveryState: "Delhi",
  deliveryPincode: "110001",
};

function fillCart() {
  db.cartItems = [
    {
      productId: "prod_1",
      variantId: null,
      variant: null,
      quantity: 2,
      isSchemeItem: false,
      product: { isActive: true, stockStatus: "IN_STOCK", price: 100, gstRate: 18, categoryId: "cat_1" },
    },
  ];
}

function place(headers: Record<string, string>) {
  return POST(
    new NextRequest("http://localhost/api/orders", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    })
  );
}

const mobile = (key?: string) => ({ authorization: "Bearer test-token", ...(key ? { "Idempotency-Key": key } : {}) });

beforeEach(() => {
  db.orders = [];
  db.nextId = 1;
  fillCart();
});

describe("POST /api/orders Idempotency-Key", () => {
  it("first request creates an order", async () => {
    const res = await place(mobile("11111111-1111-4111-8111-111111111111"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.order.id).toBe("order_1");
    expect(db.orders).toHaveLength(1);
    expect(db.orders[0].idempotencyKey).toBe("11111111-1111-4111-8111-111111111111");
  });

  it("a second identical request returns the same order and creates nothing", async () => {
    const key = "22222222-2222-4222-8222-222222222222";
    const first = await place(mobile(key));
    const firstJson = await first.json();

    fillCart(); // even with items back in the cart, the retry must not create
    const second = await place(mobile(key));
    expect(second.status).toBe(first.status);
    expect(second.headers.get("Idempotent-Replayed")).toBe("true");
    const secondJson = await second.json();
    expect(secondJson.order.id).toBe(firstJson.order.id);
    expect(secondJson.order.orderNumber).toBe(firstJson.order.orderNumber);
    expect(db.orders).toHaveLength(1);
  });

  it("a retry after the cart was cleared still returns the order (not 'Cart is empty')", async () => {
    const key = "33333333-3333-4333-8333-333333333333";
    await place(mobile(key));
    expect(db.cartItems).toHaveLength(0);
    const retry = await place(mobile(key));
    expect(retry.status).toBe(200);
    expect((await retry.json()).order.id).toBe("order_1");
  });

  it("different keys create different orders", async () => {
    const a = await (await place(mobile("44444444-4444-4444-8444-444444444444"))).json();
    fillCart();
    const b = await (await place(mobile("55555555-5555-4555-8555-555555555555"))).json();
    expect(a.order.id).not.toBe(b.order.id);
    expect(db.orders).toHaveLength(2);
  });

  it("concurrent requests with the same key create one order", async () => {
    const key = "66666666-6666-4666-8666-666666666666";
    const [r1, r2] = await Promise.all([place(mobile(key)), place(mobile(key))]);
    expect([r1.status, r2.status]).toEqual([200, 200]);
    const [j1, j2] = await Promise.all([r1.json(), r2.json()]);
    expect(j1.order.id).toBe(j2.order.id);
    expect(db.orders).toHaveLength(1);
  });

  it("mobile request without the header (older app build) still creates the order", async () => {
    const res = await place(mobile());
    expect(res.status).toBe(200);
    expect(db.orders).toHaveLength(1);
    expect(db.orders[0].idempotencyKey).toBeNull();
  });

  it("web request (cookie session, no header) keeps current behaviour", async () => {
    const res = await place({});
    expect(res.status).toBe(200);
    expect(db.orders).toHaveLength(1);
    expect(db.orders[0].idempotencyKey).toBeNull();
  });

  it("malformed key is rejected", async () => {
    const res = await place(mobile("bad key!"));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("IDEMPOTENCY_KEY_INVALID");
  });
});
