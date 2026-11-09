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
vi.mock("@/lib/prisma", () => ({
  prisma: {
    shipment: { count: (...a: unknown[]) => shipmentCount(...a) },
  },
}));

const { nextPickupSlot, previousSlotCutoff, requestDelhiveryPickup } = await import("./pickup");

const ENV = { ...process.env };
beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.DELHIVERY_AUTO_PICKUP;
  delete process.env.DELHIVERY_PICKUP_TIME;
  shipmentCount.mockResolvedValue(3);
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

  it("accepts the HH:MM form (DELHIVERY_PICKUP_TIME=16:00) and normalises it to HH:MM:SS", () => {
    process.env.DELHIVERY_PICKUP_TIME = "15:00";
    expect(nextPickupSlot(new Date("2026-11-01T04:00:00Z")).pickupTime).toBe("15:00:00");
    process.env.DELHIVERY_PICKUP_TIME = "16:00";
    expect(nextPickupSlot(new Date("2026-11-01T04:00:00Z")).pickupTime).toBe("16:00:00");
  });

  it("honours DELHIVERY_PICKUP_TIME and ignores malformed values", () => {
    process.env.DELHIVERY_PICKUP_TIME = "15:00:00";
    expect(nextPickupSlot(new Date("2026-11-01T04:00:00Z")).pickupTime).toBe("15:00:00");
    process.env.DELHIVERY_PICKUP_TIME = "4pm";
    expect(nextPickupSlot(new Date("2026-11-01T04:00:00Z")).pickupTime).toBe("16:00:00");
  });
});

describe("previousSlotCutoff - lower bound of the orders waiting for a slot", () => {
  // Slot 16:00 IST, cutoff 30 min before => 15:30 IST = 10:00 UTC, on the PREVIOUS day.
  it("is the previous day's slot cutoff", () => {
    expect(previousSlotCutoff("2026-11-02", "16:00:00").toISOString()).toBe("2026-11-01T10:00:00.000Z");
  });

  it("agrees with nextPickupSlot: an order just before the cutoff is in today's slot, just after rolls to tomorrow's", () => {
    const cutoffOf2nd = previousSlotCutoff("2026-11-02", "16:00:00").getTime(); // 1 Nov 10:00 UTC
    const justBefore = new Date(cutoffOf2nd - 60_000);
    const justAfter = new Date(cutoffOf2nd + 60_000);
    expect(nextPickupSlot(justBefore).pickupDate).toBe("2026-11-01");
    expect(nextPickupSlot(justAfter).pickupDate).toBe("2026-11-02");
    // ...and a window starting at the cutoff of the 2nd contains justAfter but not justBefore.
    expect(justAfter.getTime()).toBeGreaterThanOrEqual(cutoffOf2nd);
    expect(justBefore.getTime()).toBeLessThan(cutoffOf2nd);
  });

  it("works across a month boundary", () => {
    expect(previousSlotCutoff("2026-12-01", "16:00:00").toISOString()).toBe("2026-11-30T10:00:00.000Z");
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

  it("scopes the waiting-package count to the channel and the configured location (incl. legacy orders)", async () => {
    await requestDelhiveryPickup("B2C", new Date("2026-11-01T04:00:00Z"));
    expect(shipmentCount).toHaveBeenCalledWith({
      where: {
        status: "MANIFESTED",
        order: { channel: "B2C", OR: [{ pickupLocationName: null }, { pickupLocationName: "LOC-B2C" }] },
      },
    });
  });

  it("books a vendor warehouse's pickup at that warehouse, counting only its parcels", async () => {
    shipmentCount.mockResolvedValue(2);
    const r = await requestDelhiveryPickup("B2C", new Date("2026-11-01T04:00:00Z"), "VND-VND12345678-110020");
    expect(shipmentCount).toHaveBeenCalledWith({
      where: { status: "MANIFESTED", order: { channel: "B2C", pickupLocationName: "VND-VND12345678-110020" } },
    });
    const [, opts] = delhiveryFetchMock.mock.calls[0];
    expect(JSON.parse(opts.body)).toMatchObject({ pickup_location: "VND-VND12345678-110020", expected_package_count: 2 });
    expect(r.packageCount).toBe(2);
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
