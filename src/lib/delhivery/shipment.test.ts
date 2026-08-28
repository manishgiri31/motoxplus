import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

// F-03: create.json must not be auto-retried, and a unique-constraint
// violation from a concurrent create must be handled, not surfaced as a 500.

const delhiveryPost = vi.fn();
vi.mock("./client", () => ({ delhiveryPost: (...a: unknown[]) => delhiveryPost(...a) }));

vi.mock("./config", () => ({
  getDelhiveryConfig: () => ({
    token: "test-token-1234567890123456789",
    baseUrl: "https://track.delhivery.com",
    pickup: { name: "P", address: "A", city: "C", state: "S", phone: "9999999999", pincode: "110046", locationName: "L" },
    companyGst: "07AAUCM5765B1Z4",
    clientName: "test-client",
  }),
}));

const prismaMock = {
  order: { findUnique: vi.fn(), update: vi.fn() },
  shipment: { findUnique: vi.fn(), create: vi.fn() },
  $transaction: vi.fn(),
};
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const { createDelhiveryShipment } = await import("./shipment");

const ORDER = {
  id: "order_1",
  orderNumber: "MX-1",
  paymentType: "COD",
  grandTotal: 1000,
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

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.order.findUnique.mockResolvedValue({ ...ORDER });
  delhiveryPost.mockResolvedValue(CREATE_OK);
});

describe("createDelhiveryShipment — F-03 retry suppression", () => {
  it("calls create.json with retries:1 (no auto-retry)", async () => {
    prismaMock.$transaction.mockResolvedValue(undefined);
    await createDelhiveryShipment("order_1");
    expect(delhiveryPost).toHaveBeenCalledTimes(1);
    expect(delhiveryPost).toHaveBeenCalledWith("/api/cmu/create.json", expect.any(Object), { retries: 1 });
  });
});

describe("createDelhiveryShipment — F-03 unique-constraint handling", () => {
  it("recovers from a P2002 (concurrent create won the race) instead of throwing", async () => {
    prismaMock.$transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "6.x",
        meta: { target: ["orderId"] },
      })
    );
    prismaMock.shipment.findUnique.mockResolvedValue({
      waybill: "57930810000011",
      trackingUrl: "https://www.delhivery.com/track/package/57930810000011",
    });

    const result = await createDelhiveryShipment("order_1");
    expect(result.waybill).toBe("57930810000011"); // the row that actually won
  });

  it("re-throws a non-P2002 database error", async () => {
    prismaMock.$transaction.mockRejectedValue(new Error("connection reset"));
    await expect(createDelhiveryShipment("order_1")).rejects.toThrow("connection reset");
  });
});
