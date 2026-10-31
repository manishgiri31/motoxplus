import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const createShipmentForOrderMock = vi.fn();
vi.mock("./provider", () => ({
  createShipmentForOrder: (...a: unknown[]) => createShipmentForOrderMock(...a),
}));

const autoRequestPickupMock = vi.fn().mockResolvedValue(undefined);
vi.mock("./pickup", () => ({
  autoRequestPickup: (...a: unknown[]) => autoRequestPickupMock(...a),
}));

const orderEventCreate = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { orderEvent: { create: (...a: unknown[]) => orderEventCreate(...a) } },
}));

const { autoCreateShipment, isAutoShipmentEnabled } = await import("./auto-shipment");

const ENV = process.env.DELHIVERY_AUTO_SHIPMENT;

beforeEach(() => {
  vi.clearAllMocks();
  orderEventCreate.mockResolvedValue({});
  autoRequestPickupMock.mockResolvedValue(undefined);
});
afterEach(() => {
  if (ENV === undefined) delete process.env.DELHIVERY_AUTO_SHIPMENT;
  else process.env.DELHIVERY_AUTO_SHIPMENT = ENV;
});

describe("isAutoShipmentEnabled", () => {
  it("defaults ON when unset", () => {
    delete process.env.DELHIVERY_AUTO_SHIPMENT;
    expect(isAutoShipmentEnabled()).toBe(true);
  });

  it("is OFF only for an explicit 'false' (case/space insensitive)", () => {
    for (const v of ["false", "FALSE", "  False  "]) {
      process.env.DELHIVERY_AUTO_SHIPMENT = v;
      expect(isAutoShipmentEnabled()).toBe(false);
    }
    for (const v of ["true", "1", "yes", ""]) {
      process.env.DELHIVERY_AUTO_SHIPMENT = v;
      expect(isAutoShipmentEnabled()).toBe(true);
    }
  });
});

describe("autoCreateShipment", () => {
  it("creates the shipment and records SHIPMENT_CREATED when enabled", async () => {
    delete process.env.DELHIVERY_AUTO_SHIPMENT;
    createShipmentForOrderMock.mockResolvedValue({ kind: "b2c-awb", waybill: "AWB123", trackingUrl: "u" });

    await autoCreateShipment("order_1");

    expect(createShipmentForOrderMock).toHaveBeenCalledWith("order_1");
    expect(autoRequestPickupMock).toHaveBeenCalledWith("order_1");
    expect(orderEventCreate).toHaveBeenCalledWith({
      data: { orderId: "order_1", type: "SHIPMENT_CREATED", reason: expect.stringContaining("AWB123") },
    });
  });

  it("B2B: submits via the provider, records no AWB event (the job_id event is written by the B2B module), still books the pickup", async () => {
    delete process.env.DELHIVERY_AUTO_SHIPMENT;
    createShipmentForOrderMock.mockResolvedValue({ kind: "b2b-manifest", jobId: "job-1", alreadySubmitted: false });

    await autoCreateShipment("order_b2b");

    expect(createShipmentForOrderMock).toHaveBeenCalledWith("order_b2b");
    expect(orderEventCreate).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: "SHIPMENT_CREATED" }) })
    );
    expect(autoRequestPickupMock).toHaveBeenCalledWith("order_b2b");
  });

  it("skips the API call and records SHIPMENT_AUTO_SKIPPED when disabled", async () => {
    process.env.DELHIVERY_AUTO_SHIPMENT = "false";

    await autoCreateShipment("order_1");

    expect(createShipmentForOrderMock).not.toHaveBeenCalled();
    expect(autoRequestPickupMock).not.toHaveBeenCalled();
    expect(orderEventCreate).toHaveBeenCalledWith({
      data: { orderId: "order_1", type: "SHIPMENT_AUTO_SKIPPED", reason: expect.any(String) },
    });
  });

  it("never throws on a Delhivery failure — records SHIPMENT_FAILED instead", async () => {
    delete process.env.DELHIVERY_AUTO_SHIPMENT;
    createShipmentForOrderMock.mockRejectedValue(new Error("Delhivery rejected shipment: bad pin"));

    await expect(autoCreateShipment("order_1")).resolves.toBeUndefined();

    expect(autoRequestPickupMock).not.toHaveBeenCalled();
    expect(orderEventCreate).toHaveBeenCalledWith({
      data: { orderId: "order_1", type: "SHIPMENT_FAILED", reason: expect.stringContaining("bad pin") },
    });
  });

  it("never throws even if the OrderEvent write itself fails", async () => {
    delete process.env.DELHIVERY_AUTO_SHIPMENT;
    createShipmentForOrderMock.mockResolvedValue({ kind: "b2c-awb", waybill: "AWB123", trackingUrl: "u" });
    orderEventCreate.mockRejectedValue(new Error("db down"));

    await expect(autoCreateShipment("order_1")).resolves.toBeUndefined();
  });
});
