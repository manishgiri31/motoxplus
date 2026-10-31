import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createPickupRequestStore } from "./test-support/pickup-request-store";

// autoRequestPickup end to end through the REAL providers and the REAL
// once-per-day booking, with every HTTP call mocked. The fake store enforces the
// same unique key as the PickupRequest table.

const delhiveryFetchMock = vi.fn(); // B2C: POST /fm/request/new/
vi.mock("./client", () => ({ delhiveryFetch: (...a: unknown[]) => delhiveryFetchMock(...a) }));

const requestB2bPickupMock = vi.fn(); // B2B: POST /pickup_requests/
vi.mock("./b2b/pickup", () => ({ requestB2bPickup: (...a: unknown[]) => requestB2bPickupMock(...a) }));

const getB2bWaitingPackagesMock = vi.fn();
vi.mock("./b2b/shipment", () => ({
  createB2bShipment: vi.fn(),
  getB2bWaitingPackages: (...a: unknown[]) => getB2bWaitingPackagesMock(...a),
}));
vi.mock("./shipment", () => ({ createDelhiveryShipment: vi.fn() }));

// Both Delhivery clients register a warehouse with the SAME name.
vi.mock("./config", () => ({
  toDelhiveryChannel: (v: unknown) => {
    if (v === "B2C" || v === "B2B") return v;
    throw new Error(`bad channel ${String(v)}`);
  },
  getDelhiveryConfig: (channel = "B2C") => ({ pickup: { locationName: "MOTOXPLUS_PALAM", channel } }),
}));
vi.mock("./b2b/config", () => ({ getB2bConfig: () => ({ pickupLocationName: "MOTOXPLUS_PALAM" }) }));

const store = createPickupRequestStore();
const orderChannel: Record<string, string> = {};
const shipmentCount = vi.fn();
const orderEventCreate = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: { findUnique: async ({ where }: { where: { id: string } }) => (orderChannel[where.id] ? { channel: orderChannel[where.id] } : null) },
    shipment: { count: (...a: unknown[]) => shipmentCount(...a) },
    orderEvent: { create: (...a: unknown[]) => orderEventCreate(...a) },
    pickupRequest: {
      create: (...a: unknown[]) => (store.pickupRequest.create as (...x: unknown[]) => unknown)(...a),
      findUnique: (...a: unknown[]) => (store.pickupRequest.findUnique as (...x: unknown[]) => unknown)(...a),
      update: (...a: unknown[]) => (store.pickupRequest.update as (...x: unknown[]) => unknown)(...a),
      updateMany: (...a: unknown[]) => (store.pickupRequest.updateMany as (...x: unknown[]) => unknown)(...a),
      deleteMany: (...a: unknown[]) => (store.pickupRequest.deleteMany as (...x: unknown[]) => unknown)(...a),
    },
  },
}));

const { autoRequestPickup } = await import("./auto-pickup");

const ENV = { ...process.env };
const events = () => orderEventCreate.mock.calls.map(([a]) => a.data as { orderId: string; type: string; reason: string });
const typesFor = (id: string) => events().filter((e) => e.orderId === id).map((e) => e.type);

beforeEach(() => {
  vi.clearAllMocks();
  store.reset();
  for (const k of Object.keys(orderChannel)) delete orderChannel[k];
  Object.assign(orderChannel, { o1: "B2C", o2: "B2C", b1: "B2B", b2: "B2B" });
  delete process.env.DELHIVERY_AUTO_PICKUP;
  delete process.env.DELHIVERY_PICKUP_TIME;
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-02T04:00:00Z")); // 09:30 IST, well before the 16:00 slot
  shipmentCount.mockResolvedValue(1);
  orderEventCreate.mockResolvedValue({});
  delhiveryFetchMock.mockResolvedValue({ pickup_id: 987 });
  requestB2bPickupMock.mockResolvedValue({});
  getB2bWaitingPackagesMock.mockResolvedValue(1);
});
afterEach(() => {
  vi.useRealTimers();
  process.env = { ...ENV };
});

describe("B2C: two orders, one warehouse, one pickup", () => {
  it("sends the pickup request once; the second order sees it open and sends nothing", async () => {
    shipmentCount.mockResolvedValueOnce(2); // both shipments are already MANIFESTED when the first order books

    await autoRequestPickup("o1");
    await autoRequestPickup("o2");

    expect(delhiveryFetchMock).toHaveBeenCalledTimes(1);
    const [path, opts] = delhiveryFetchMock.mock.calls[0];
    expect(path).toBe("/fm/request/new/");
    expect(JSON.parse(opts.body)).toEqual({
      pickup_time: "16:00:00",
      pickup_date: "2026-11-02",
      pickup_location: "MOTOXPLUS_PALAM",
      expected_package_count: 2, // the warehouse's waiting packages, not 1-per-order
    });
    expect(typesFor("o1")).toEqual(["PICKUP_REQUESTED"]);
    expect(typesFor("o2")).toEqual(["PICKUP_ALREADY_OPEN"]);
    expect(store.rows).toHaveLength(1);
  });

  it("two orders at the same moment: still one request", async () => {
    await Promise.all([autoRequestPickup("o1"), autoRequestPickup("o2")]);
    expect(delhiveryFetchMock).toHaveBeenCalledTimes(1);
    expect([...typesFor("o1"), ...typesFor("o2")].sort()).toEqual(["PICKUP_ALREADY_OPEN", "PICKUP_REQUESTED"]);
  });

  it("the next day is a new pickup", async () => {
    await autoRequestPickup("o1");
    vi.setSystemTime(new Date("2026-11-03T04:00:00Z"));
    await autoRequestPickup("o2");

    expect(delhiveryFetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(delhiveryFetchMock.mock.calls[1][1].body).pickup_date).toBe("2026-11-03");
  });

  it("an order after the cutoff rolls into tomorrow's pickup instead of piggy-backing on today's", async () => {
    await autoRequestPickup("o1"); // 09:30 IST -> slot 2 Nov
    vi.setSystemTime(new Date("2026-11-02T10:30:00Z")); // 16:00 IST, past the 15:30 cutoff
    await autoRequestPickup("o2"); // -> slot 3 Nov

    expect(delhiveryFetchMock).toHaveBeenCalledTimes(2);
    expect(typesFor("o2")).toEqual(["PICKUP_REQUESTED"]);
  });

  it("a failed request is recorded and the day is NOT left blocked: the next order retries", async () => {
    delhiveryFetchMock.mockRejectedValueOnce(new Error("Delhivery API error 500: boom"));

    await autoRequestPickup("o1");
    await autoRequestPickup("o2");

    expect(typesFor("o1")).toEqual(["PICKUP_FAILED"]);
    expect(typesFor("o2")).toEqual(["PICKUP_REQUESTED"]);
    expect(delhiveryFetchMock).toHaveBeenCalledTimes(2);
  });

  it("Delhivery answering 'already exists' (booked in the dashboard) is treated as open, not failed", async () => {
    delhiveryFetchMock.mockRejectedValueOnce(new Error("Delhivery API error 400: Pickup request already exists"));
    await autoRequestPickup("o1");
    expect(typesFor("o1")).toEqual(["PICKUP_ALREADY_OPEN"]);
    await autoRequestPickup("o2");
    expect(delhiveryFetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("B2B: two orders, one warehouse, one pickup", () => {
  it("sends one POST /pickup_requests/ with the warehouse's waiting packages; the second order sends nothing", async () => {
    getB2bWaitingPackagesMock.mockResolvedValue(2);

    await autoRequestPickup("b1");
    await autoRequestPickup("b2");

    expect(requestB2bPickupMock).toHaveBeenCalledTimes(1);
    expect(requestB2bPickupMock).toHaveBeenCalledWith({
      pickupDate: "2026-11-02",
      startTime: "16:00:00",
      expectedPackageCount: 2,
    });
    expect(delhiveryFetchMock).not.toHaveBeenCalled(); // never the B2C client
    expect(typesFor("b1")).toEqual(["PICKUP_REQUESTED"]);
    expect(typesFor("b2")).toEqual(["PICKUP_ALREADY_OPEN"]);
  });

  it("counts only manifests since the previous slot's cutoff (this slot's orders)", async () => {
    await autoRequestPickup("b1");
    // slot 2 Nov, 16:00 IST -> window opens at the 1 Nov 15:30 IST cutoff = 1 Nov 10:00 UTC
    expect((getB2bWaitingPackagesMock.mock.calls[0][0] as Date).toISOString()).toBe("2026-11-01T10:00:00.000Z");
  });

  it("a failed B2B request releases the day for the next order", async () => {
    requestB2bPickupMock.mockRejectedValueOnce(new Error("Delhivery B2B API error 400"));
    await autoRequestPickup("b1");
    await autoRequestPickup("b2");
    expect(typesFor("b1")).toEqual(["PICKUP_FAILED"]);
    expect(typesFor("b2")).toEqual(["PICKUP_REQUESTED"]);
  });
});

describe("one pickup per CHANNEL + warehouse", () => {
  it("B2C and B2B share a warehouse name but are different Delhivery clients: one pickup each", async () => {
    await autoRequestPickup("o1"); // B2C
    await autoRequestPickup("b1"); // B2B
    await autoRequestPickup("o2"); // B2C again  -> open
    await autoRequestPickup("b2"); // B2B again  -> open

    expect(delhiveryFetchMock).toHaveBeenCalledTimes(1);
    expect(requestB2bPickupMock).toHaveBeenCalledTimes(1);
    expect(store.rows.map((r) => r.channel).sort()).toEqual(["B2B", "B2C"]);
  });
});

describe("guards", () => {
  it("DELHIVERY_AUTO_PICKUP=false -> PICKUP_AUTO_SKIPPED, no claim, no API call", async () => {
    process.env.DELHIVERY_AUTO_PICKUP = "false";
    await autoRequestPickup("o1");
    expect(typesFor("o1")).toEqual(["PICKUP_AUTO_SKIPPED"]);
    expect(store.rows).toHaveLength(0);
    expect(delhiveryFetchMock).not.toHaveBeenCalled();
  });

  it("a missing order is a PICKUP_FAILED event, never a throw, never an API call", async () => {
    await expect(autoRequestPickup("ghost")).resolves.toBeUndefined();
    expect(typesFor("ghost")).toEqual(["PICKUP_FAILED"]);
    expect(delhiveryFetchMock).not.toHaveBeenCalled();
  });
});
