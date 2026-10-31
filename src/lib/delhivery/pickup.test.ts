import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const delhiveryFetchMock = vi.fn();
vi.mock("./client", () => ({
  delhiveryFetch: (...a: unknown[]) => delhiveryFetchMock(...a),
}));
vi.mock("./config", () => ({
  toDelhiveryChannel: (v: unknown) => {
    if (v === "B2C" || v === "B2B") return v;
    throw new Error(`bad channel ${String(v)}`);
  },
  getDelhiveryConfig: (channel = "B2C") => ({ pickup: { locationName: `LOC-${channel}` } }),
}));

const shipmentCount = vi.fn();
const orderFindUnique = vi.fn();
const orderEventCreate = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    shipment: { count: (...a: unknown[]) => shipmentCount(...a) },
    order: { findUnique: (...a: unknown[]) => orderFindUnique(...a) },
    orderEvent: { create: (...a: unknown[]) => orderEventCreate(...a) },
  },
}));

const { nextPickupSlot, requestDelhiveryPickup, autoRequestPickup } = await import("./pickup");

const ENV = { ...process.env };
beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.DELHIVERY_AUTO_PICKUP;
  delete process.env.DELHIVERY_PICKUP_TIME;
  shipmentCount.mockResolvedValue(3);
  orderEventCreate.mockResolvedValue({});
  orderFindUnique.mockResolvedValue({ channel: "B2C" });
  delhiveryFetchMock.mockResolvedValue({ pickup_id: 987 });
});
afterEach(() => {
  process.env = { ...ENV };
});

// IST = UTC+5:30, so 08:00 UTC = 13:30 IST.
describe("nextPickupSlot", () => {
  it("books today when the slot is still more than 30 minutes away", () => {
    expect(nextPickupSlot(new Date("2026-11-01T08:00:00Z"))).toEqual({
      pickupDate: "2026-11-01",
      pickupTime: "16:00:00",
    });
  });

  it("rolls to tomorrow once the slot is inside the 30-minute cutoff", () => {
    // 10:00 UTC = 15:30 IST, slot 16:00 is 30 min away
    expect(nextPickupSlot(new Date("2026-11-01T10:00:00Z")).pickupDate).toBe("2026-11-02");
  });

  it("uses the IST date, not the UTC date (late-evening IST is still the same UTC day)", () => {
    // 20:00 UTC on 1 Nov = 01:30 IST on 2 Nov -> today's slot is 2 Nov
    expect(nextPickupSlot(new Date("2026-11-01T20:00:00Z")).pickupDate).toBe("2026-11-02");
  });

  it("honours DELHIVERY_PICKUP_TIME and ignores malformed values", () => {
    process.env.DELHIVERY_PICKUP_TIME = "15:00:00";
    expect(nextPickupSlot(new Date("2026-11-01T04:00:00Z")).pickupTime).toBe("15:00:00");
    process.env.DELHIVERY_PICKUP_TIME = "4pm";
    expect(nextPickupSlot(new Date("2026-11-01T04:00:00Z")).pickupTime).toBe("16:00:00");
  });
});

describe("requestDelhiveryPickup", () => {
  it("POSTs the registered pickup location with the waiting package count", async () => {
    const r = await requestDelhiveryPickup("B2C", new Date("2026-11-01T04:00:00Z"));

    const [path, opts] = delhiveryFetchMock.mock.calls[0];
    expect(path).toBe("/fm/request/new/");
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body)).toEqual({
      pickup_time: "16:00:00",
      pickup_date: "2026-11-01",
      pickup_location: "LOC-B2C",
      expected_package_count: 3,
    });
    expect(r.pickupId).toBe("987");
  });

  it("scopes the waiting-package count to the channel", async () => {
    await requestDelhiveryPickup("B2B", new Date("2026-11-01T04:00:00Z"));
    expect(shipmentCount).toHaveBeenCalledWith({ where: { status: "MANIFESTED", order: { channel: "B2B" } } });
  });

  it("B2B: uses the B2B token and the B2B pickup location", async () => {
    await requestDelhiveryPickup("B2B", new Date("2026-11-01T04:00:00Z"));
    const [, opts] = delhiveryFetchMock.mock.calls[0];
    expect(opts.channel).toBe("B2B");
    expect(JSON.parse(opts.body).pickup_location).toBe("LOC-B2B");
  });

  it("B2C: uses the B2C token and the B2C pickup location", async () => {
    await requestDelhiveryPickup("B2C", new Date("2026-11-01T04:00:00Z"));
    const [, opts] = delhiveryFetchMock.mock.calls[0];
    expect(opts.channel).toBe("B2C");
    expect(JSON.parse(opts.body).pickup_location).toBe("LOC-B2C");
  });

  it("treats an 'already exists' rejection as success", async () => {
    delhiveryFetchMock.mockRejectedValue(new Error("Delhivery API error 400: Pickup request already exists"));
    const r = await requestDelhiveryPickup("B2C", new Date("2026-11-01T04:00:00Z"));
    expect(r.alreadyScheduled).toBe(true);
  });

  it("rethrows any other failure", async () => {
    delhiveryFetchMock.mockRejectedValue(new Error("Delhivery API error 500: boom"));
    await expect(requestDelhiveryPickup("B2C")).rejects.toThrow("boom");
  });
});

describe("autoRequestPickup", () => {
  it("records PICKUP_REQUESTED on success", async () => {
    await autoRequestPickup("order_1");
    expect(orderEventCreate).toHaveBeenCalledWith({
      data: { orderId: "order_1", type: "PICKUP_REQUESTED", reason: expect.stringContaining("987") },
    });
  });

  it("books the pickup on the channel of the order that was just shipped", async () => {
    orderFindUnique.mockResolvedValue({ channel: "B2B" });
    await autoRequestPickup("order_1");
    expect(orderFindUnique).toHaveBeenCalledWith({ where: { id: "order_1" }, select: { channel: true } });
    expect(delhiveryFetchMock.mock.calls[0][1].channel).toBe("B2B");
    expect(orderEventCreate).toHaveBeenCalledWith({
      data: { orderId: "order_1", type: "PICKUP_REQUESTED", reason: expect.stringContaining("[B2B]") },
    });
  });

  it("records PICKUP_FAILED (no API call) when the order is missing", async () => {
    orderFindUnique.mockResolvedValue(null);
    await autoRequestPickup("order_1");
    expect(delhiveryFetchMock).not.toHaveBeenCalled();
    expect(orderEventCreate).toHaveBeenCalledWith({
      data: { orderId: "order_1", type: "PICKUP_FAILED", reason: expect.stringContaining("not found") },
    });
  });

  it("never throws — records PICKUP_FAILED instead", async () => {
    delhiveryFetchMock.mockRejectedValue(new Error("Delhivery API error 401: nope"));
    await expect(autoRequestPickup("order_1")).resolves.toBeUndefined();
    expect(orderEventCreate).toHaveBeenCalledWith({
      data: { orderId: "order_1", type: "PICKUP_FAILED", reason: expect.stringContaining("nope") },
    });
  });

  it("is skipped when DELHIVERY_AUTO_PICKUP=false", async () => {
    process.env.DELHIVERY_AUTO_PICKUP = "false";
    await autoRequestPickup("order_1");
    expect(delhiveryFetchMock).not.toHaveBeenCalled();
    expect(orderEventCreate).toHaveBeenCalledWith({
      data: { orderId: "order_1", type: "PICKUP_AUTO_SKIPPED", reason: expect.any(String) },
    });
  });
});
