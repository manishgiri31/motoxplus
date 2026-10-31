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
}));

const createB2bShipmentMock = vi.fn();
vi.mock("./b2b/shipment", () => ({
  createB2bShipment: (...a: unknown[]) => createB2bShipmentMock(...a),
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
    expect(requestDelhiveryPickupMock).toHaveBeenCalledWith("B2C");
    expect(requestB2bPickupMock).not.toHaveBeenCalled();
    expect(r).toMatchObject({ channel: "B2C", pickupId: "9", packageCount: 2 });
  });

  it("B2B provider uses the B2B pickup with the slot split into pickup_date / start_time", async () => {
    const r = await getProvider("B2B").requestPickup("o1");
    expect(requestB2bPickupMock).toHaveBeenCalledWith({
      pickupDate: "2026-11-02",
      startTime: "16:00:00",
      expectedPackageCount: 1,
    });
    expect(requestDelhiveryPickupMock).not.toHaveBeenCalled();
    expect(r.channel).toBe("B2B");
  });
});

describe("registerWarehouse", () => {
  it("is unimplemented on both sides until each spec is provided (they are different payloads)", async () => {
    await expect(getProvider("B2C").registerWarehouse()).rejects.toBeInstanceOf(DelhiveryNotSpecifiedError);
    await expect(getProvider("B2B").registerWarehouse()).rejects.toBeInstanceOf(DelhiveryNotSpecifiedError);
  });
});
