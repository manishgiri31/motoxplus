import { describe, it, expect, vi, beforeEach } from "vitest";

// Order.channel decides which module runs. Lower layers are mocked, so this
// pins the routing: B2C -> existing track.delhivery.com code, B2B -> B2B module.

const createDelhiveryShipmentMock = vi.fn();
vi.mock("./shipment", () => ({
  createDelhiveryShipment: (...a: unknown[]) => createDelhiveryShipmentMock(...a),
}));

const requestDelhiveryPickupMock = vi.fn();
vi.mock("./pickup", () => ({
  requestDelhiveryPickup: (...a: unknown[]) => requestDelhiveryPickupMock(...a),
  nextPickupSlot: () => ({ pickupDate: "2026-11-02", pickupTime: "16:00:00" }),
  previousSlotCutoff: () => new Date("2026-11-01T10:00:00Z"),
}));

// The booking wrapper is covered in pickup-day.test.ts / auto-pickup.test.ts;
// here it just runs `send` so this file pins what each provider sends.
vi.mock("./pickup-day", () => ({
  bookPickupOncePerDay: async (p: { channel: string; warehouse: string; pickupDate: string; pickupTime: string; send: () => Promise<Record<string, unknown>> }) => {
    const sent = await p.send();
    return { channel: p.channel, warehouse: p.warehouse, pickupDate: p.pickupDate, pickupTime: p.pickupTime, alreadyOpen: false, ...sent };
  },
}));
vi.mock("./config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./config")>();
  return { ...actual, getDelhiveryConfig: () => ({ pickup: { locationName: "WH-B2C" } }) };
});
vi.mock("./b2b/config", () => ({ getB2bConfig: () => ({ pickupLocationName: "WH-B2B" }) }));

const createB2bShipmentMock = vi.fn();

const getB2bWaitingPackagesMock = vi.fn();
vi.mock("./b2b/shipment", () => ({
  createB2bShipment: (...a: unknown[]) => createB2bShipmentMock(...a),
  getB2bWaitingPackages: (...a: unknown[]) => getB2bWaitingPackagesMock(...a),
}));

const requestB2bPickupMock = vi.fn();
vi.mock("./b2b/pickup", () => ({
  requestB2bPickup: (...a: unknown[]) => requestB2bPickupMock(...a),
}));

const orderFindUnique = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { order: { findUnique: (...a: unknown[]) => orderFindUnique(...a) } },
}));

const { getProvider, createShipmentForOrder } = await import("./provider");
const { DelhiveryNotSpecifiedError } = await import("./errors");

beforeEach(() => {
  vi.clearAllMocks();
  createDelhiveryShipmentMock.mockResolvedValue({ waybill: "AWB1", trackingUrl: "u" });
  createB2bShipmentMock.mockResolvedValue({ jobId: "job-1", alreadySubmitted: false });
  requestDelhiveryPickupMock.mockResolvedValue({
    pickupId: "9",
    pickupDate: "2026-11-02",
    pickupTime: "16:00:00",
    packageCount: 2,
    channel: "B2C",
    alreadyScheduled: false,
  });
  requestB2bPickupMock.mockResolvedValue({});
  getB2bWaitingPackagesMock.mockResolvedValue(2);
});

describe("createShipmentForOrder — Order.channel picks the module", () => {
  it("B2C (fallback/legacy path): the existing create.json code, B2B module untouched", async () => {
    orderFindUnique.mockResolvedValue({ channel: "B2C" });

    const r = await createShipmentForOrder("o1");

    expect(r).toEqual({ kind: "b2c-awb", waybill: "AWB1", trackingUrl: "u" });
    expect(createDelhiveryShipmentMock).toHaveBeenCalledWith("o1");
    expect(createB2bShipmentMock).not.toHaveBeenCalled();
  });

  it("B2B: the B2B manifest module, create.json never called", async () => {
    orderFindUnique.mockResolvedValue({ channel: "B2B" });

    const r = await createShipmentForOrder("o1");

    expect(r).toEqual({ kind: "b2b-manifest", jobId: "job-1", alreadySubmitted: false });
    expect(createB2bShipmentMock).toHaveBeenCalledWith("o1");
    expect(createDelhiveryShipmentMock).not.toHaveBeenCalled();
  });

  it("unknown order / channel fails instead of guessing a client", async () => {
    orderFindUnique.mockResolvedValue(null);
    await expect(createShipmentForOrder("o1")).rejects.toThrow(/not found/);
    orderFindUnique.mockResolvedValue({ channel: "WHOLESALE" });
    await expect(createShipmentForOrder("o1")).rejects.toThrow(/Unknown order channel/);
    expect(createDelhiveryShipmentMock).not.toHaveBeenCalled();
    expect(createB2bShipmentMock).not.toHaveBeenCalled();
  });
});

describe("requestPickup", () => {
  it("B2C provider uses the existing B2C pickup", async () => {
    const r = await getProvider("B2C").requestPickup("o1");
    expect(requestDelhiveryPickupMock).toHaveBeenCalledWith("B2C", expect.any(Date));
    expect(requestB2bPickupMock).not.toHaveBeenCalled();
    expect(r).toMatchObject({ channel: "B2C", warehouse: "WH-B2C", pickupId: "9", packageCount: 2 });
  });

  it("B2B provider uses the B2B pickup with the slot split into pickup_date / start_time", async () => {
    const r = await getProvider("B2B").requestPickup("o1");
    // expected_package_count = the warehouse's waiting packages since the previous cutoff
    expect(getB2bWaitingPackagesMock).toHaveBeenCalledWith(new Date("2026-11-01T10:00:00Z"));
    expect(requestB2bPickupMock).toHaveBeenCalledWith({
      pickupDate: "2026-11-02",
      startTime: "16:00:00",
      expectedPackageCount: 2,
    });
    expect(requestDelhiveryPickupMock).not.toHaveBeenCalled();
    expect(r).toMatchObject({ channel: "B2B", warehouse: "WH-B2B" });
  });
});

describe("registerWarehouse", () => {
  it("B2C is unimplemented until its own spec (name / phone / pin / return_address) is provided", async () => {
    await expect(getProvider("B2C").registerWarehouse()).rejects.toBeInstanceOf(DelhiveryNotSpecifiedError);
  });

  it("B2B requires its payload and never fires without one", async () => {
    await expect(getProvider("B2B").registerWarehouse()).rejects.toThrow(/requires the warehouse payload/);
  });
});
