import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

// createDelhiveryShipment guarantees:
//  - create.json is never auto-retried (F-03)
//  - idempotency is DB-level: a fast-path row check, then a Postgres advisory
//    lock + an in-lock re-check, then the unique constraint as a backstop
//  - payment_mode / cod_amount follow order.amountDue (what's owed at
//    delivery), so ADVANCE_20's balance actually ships COD

const delhiveryPost = vi.fn();
vi.mock("./client", () => ({ delhiveryPost: (...a: unknown[]) => delhiveryPost(...a) }));

vi.mock("./config", () => ({
  toDelhiveryChannel: (v: unknown) => {
    if (v === "B2C" || v === "B2B") return v;
    throw new Error(`bad channel ${String(v)}`);
  },
  // Channel-distinct fixtures so tests can prove which client was selected.
  getDelhiveryConfig: (channel = "B2C") => ({
    channel,
    token: `test-token-${channel}-1234567890`,
    baseUrl: "https://track.delhivery.com",
    pickup: { name: "P", address: "A", city: "C", state: "S", phone: "9999999999", pincode: "110046", locationName: `LOC-${channel}` },
    companyGst: "07AAUCM5765B1Z4",
    clientName: "test-client",
  }),
}));

const txMock = {
  $queryRaw: vi.fn(),
  order: { findUnique: vi.fn(), updateMany: vi.fn() },
  shipment: { create: vi.fn() },
};

const prismaMock = {
  shipment: { findUnique: vi.fn() },
  // Interactive form: invoke the callback with the tx client.
  $transaction: vi.fn((fn: (tx: typeof txMock) => unknown) => fn(txMock)),
};
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const { createDelhiveryShipment } = await import("./shipment");

const baseOrder = {
  id: "order_1",
  orderNumber: "MX-1",
  status: "CONFIRMED",
  channel: "B2C",
  paymentType: "COD",
  grandTotal: 1000,
  amountDue: 1000,
  createdAt: new Date("2026-08-24T00:00:00Z"),
  deliveryPincode: "135001",
  deliveryCity: "Yamunanagar",
  deliveryState: "Haryana",
  shippingAddress: "House 123",
  deliveryName: "Manish",
  deliveryPhone: "7206794749",
  dealer: { pincode: "135001", city: "Yamunanagar", state: "Haryana", address: "House 123", ownerName: "Manish", phone: "7206794749" },
  items: [{ quantity: 1, product: { name: "Part", packageWeight: 0.5, weight: 0.5, hsnCode: "87141090" } }],
  shipment: null as unknown,
};

const CREATE_OK = { success: true, packages: [{ waybill: "57930810000066", status: "Success", remarks: [""] }] };

function payloadOf(call: unknown[]): Record<string, unknown> {
  const formData = call[1] as { data: string };
  return JSON.parse(formData.data).shipments[0];
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.shipment.findUnique.mockResolvedValue(null); // no fast-path hit
  prismaMock.$transaction.mockImplementation((fn: (tx: typeof txMock) => unknown) => fn(txMock));
  txMock.$queryRaw.mockResolvedValue([]);
  txMock.order.findUnique.mockResolvedValue({ ...baseOrder });
  txMock.order.updateMany.mockResolvedValue({ count: 1 });
  txMock.shipment.create.mockResolvedValue({});
  delhiveryPost.mockResolvedValue(CREATE_OK);
});

describe("createDelhiveryShipment — F-03 retry suppression", () => {
  it("calls create.json with retries:1 (no auto-retry)", async () => {
    await createDelhiveryShipment("order_1");
    expect(delhiveryPost).toHaveBeenCalledTimes(1);
    expect(delhiveryPost).toHaveBeenCalledWith("/api/cmu/create.json", expect.any(Object), { retries: 1, channel: "B2C" });
  });

  it("takes the advisory lock before hitting create.json", async () => {
    await createDelhiveryShipment("order_1");
    expect(txMock.$queryRaw).toHaveBeenCalledTimes(1);
    const lockOrder = txMock.$queryRaw.mock.invocationCallOrder[0];
    const postOrder = delhiveryPost.mock.invocationCallOrder[0];
    expect(lockOrder).toBeLessThan(postOrder);
  });
});

describe("createDelhiveryShipment — DB-level idempotency", () => {
  it("fast-paths on a pre-existing shipment without opening a transaction", async () => {
    prismaMock.shipment.findUnique.mockResolvedValueOnce({
      waybill: "57930810000011",
      trackingUrl: "https://www.delhivery.com/track/package/57930810000011",
    });

    const result = await createDelhiveryShipment("order_1");

    expect(result.waybill).toBe("57930810000011");
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(delhiveryPost).not.toHaveBeenCalled();
  });

  it("returns the existing waybill (no second create.json) when the in-lock re-check finds a row", async () => {
    txMock.order.findUnique.mockResolvedValueOnce({
      ...baseOrder,
      shipment: { waybill: "57930810000022", trackingUrl: null },
    });

    const result = await createDelhiveryShipment("order_1");

    expect(result.waybill).toBe("57930810000022");
    expect(delhiveryPost).not.toHaveBeenCalled();
  });

  it("recovers from a P2002 (concurrent create beat the lock) instead of throwing", async () => {
    prismaMock.$transaction.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "6.x",
        meta: { target: ["orderId"] },
      })
    );
    prismaMock.shipment.findUnique
      .mockResolvedValueOnce(null) // fast path
      .mockResolvedValueOnce({ waybill: "57930810000033", trackingUrl: null }); // backstop lookup

    const result = await createDelhiveryShipment("order_1");
    expect(result.waybill).toBe("57930810000033");
  });

  it("re-throws a non-P2002 database error", async () => {
    prismaMock.$transaction.mockRejectedValueOnce(new Error("connection reset"));
    await expect(createDelhiveryShipment("order_1")).rejects.toThrow("connection reset");
  });

  it("refuses to ship a PENDING order", async () => {
    txMock.order.findUnique.mockResolvedValueOnce({ ...baseOrder, status: "PENDING" });
    await expect(createDelhiveryShipment("order_1")).rejects.toThrow(/PENDING/);
    expect(delhiveryPost).not.toHaveBeenCalled();
  });
});

describe("createDelhiveryShipment — payment_mode / cod_amount", () => {
  it("COD: ships COD for the full grand total", async () => {
    txMock.order.findUnique.mockResolvedValueOnce({ ...baseOrder, paymentType: "COD", amountDue: 1000, grandTotal: 1000 });
    await createDelhiveryShipment("order_1");
    const p = payloadOf(delhiveryPost.mock.calls[0]);
    expect(p.payment_mode).toBe("COD");
    expect(p.cod_amount).toBe(1000);
  });

  it("ADVANCE_20: ships COD for the 80% balance still owed on delivery", async () => {
    txMock.order.findUnique.mockResolvedValueOnce({
      ...baseOrder,
      paymentType: "ADVANCE_20",
      grandTotal: 1000,
      amountDue: 800, // post-finalize: grandTotal minus the 20% captured online
    });
    await createDelhiveryShipment("order_1");
    const p = payloadOf(delhiveryPost.mock.calls[0]);
    expect(p.payment_mode).toBe("COD");
    expect(p.cod_amount).toBe(800);
  });

  it("FULL_100: ships Prepaid, collects nothing", async () => {
    txMock.order.findUnique.mockResolvedValueOnce({
      ...baseOrder,
      paymentType: "FULL_100",
      grandTotal: 1000,
      amountDue: 0,
    });
    await createDelhiveryShipment("order_1");
    const p = payloadOf(delhiveryPost.mock.calls[0]);
    expect(p.payment_mode).toBe("Prepaid");
    expect(p.cod_amount).toBe(0);
  });
});

function requestOf(call: unknown[]): { shipments: unknown[]; pickup_location: { name: string } } {
  return JSON.parse((call[1] as { data: string }).data);
}

describe("createDelhiveryShipment — payment mode per payment type", () => {
  it("Razorpay/UPI FULL_100 (amountDue 0): Prepaid, cod_amount 0", async () => {
    txMock.order.findUnique.mockResolvedValueOnce({ ...baseOrder, paymentType: "FULL_100", grandTotal: 5000, amountDue: 0 });
    await createDelhiveryShipment("order_1");
    const p = payloadOf(delhiveryPost.mock.calls[0]);
    expect(p.payment_mode).toBe("Prepaid");
    expect(p.cod_amount).toBe(0);
    expect(p.total_amount).toBe(5000);
  });

  it("UPI ADVANCE_20 after verify (balance 4000 of 5000): COD, cod_amount 4000", async () => {
    txMock.order.findUnique.mockResolvedValueOnce({ ...baseOrder, paymentType: "ADVANCE_20", grandTotal: 5000, amountDue: 4000 });
    await createDelhiveryShipment("order_1");
    const p = payloadOf(delhiveryPost.mock.calls[0]);
    expect(p.payment_mode).toBe("COD");
    expect(p.cod_amount).toBe(4000);
  });
});

describe("createDelhiveryShipment — channel selection", () => {
  it("B2C order: B2C token and B2C pickup location", async () => {
    txMock.order.findUnique.mockResolvedValueOnce({ ...baseOrder, channel: "B2C" });
    await createDelhiveryShipment("order_1");
    const call = delhiveryPost.mock.calls[0];
    expect(call[2]).toEqual({ retries: 1, channel: "B2C" });
    expect(requestOf(call).pickup_location.name).toBe("LOC-B2C");
  });

  it("B2B order: B2B token and B2B pickup location", async () => {
    txMock.order.findUnique.mockResolvedValueOnce({ ...baseOrder, channel: "B2B" });
    await createDelhiveryShipment("order_1");
    const call = delhiveryPost.mock.calls[0];
    expect(call[2]).toEqual({ retries: 1, channel: "B2B" });
    expect(requestOf(call).pickup_location.name).toBe("LOC-B2B");
  });

  it("refuses an order with an unknown channel instead of guessing a client", async () => {
    txMock.order.findUnique.mockResolvedValueOnce({ ...baseOrder, channel: undefined });
    await expect(createDelhiveryShipment("order_1")).rejects.toThrow(/bad channel/);
    expect(delhiveryPost).not.toHaveBeenCalled();
  });
});
