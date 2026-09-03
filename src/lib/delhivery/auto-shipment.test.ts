import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const createDelhiveryShipmentMock = vi.fn();
vi.mock("./shipment", () => ({
  createDelhiveryShipment: (...a: unknown[]) => createDelhiveryShipmentMock(...a),
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
    createDelhiveryShipmentMock.mockResolvedValue({ waybill: "AWB123", trackingUrl: "u" });

    await autoCreateShipment("order_1");

    expect(createDelhiveryShipmentMock).toHaveBeenCalledWith("order_1");
    expect(orderEventCreate).toHaveBeenCalledWith({
      data: { orderId: "order_1", type: "SHIPMENT_CREATED", reason: expect.stringContaining("AWB123") },
    });
  });

  it("skips the API call and records SHIPMENT_AUTO_SKIPPED when disabled", async () => {
    process.env.DELHIVERY_AUTO_SHIPMENT = "false";

    await autoCreateShipment("order_1");

    expect(createDelhiveryShipmentMock).not.toHaveBeenCalled();
    expect(orderEventCreate).toHaveBeenCalledWith({
      data: { orderId: "order_1", type: "SHIPMENT_AUTO_SKIPPED", reason: expect.any(String) },
    });
  });

  it("never throws on a Delhivery failure — records SHIPMENT_FAILED instead", async () => {
    delete process.env.DELHIVERY_AUTO_SHIPMENT;
    createDelhiveryShipmentMock.mockRejectedValue(new Error("Delhivery rejected shipment: bad pin"));

    await expect(autoCreateShipment("order_1")).resolves.toBeUndefined();

    expect(orderEventCreate).toHaveBeenCalledWith({
      data: { orderId: "order_1", type: "SHIPMENT_FAILED", reason: expect.stringContaining("bad pin") },
    });
  });

  it("never throws even if the OrderEvent write itself fails", async () => {
    delete process.env.DELHIVERY_AUTO_SHIPMENT;
    createDelhiveryShipmentMock.mockResolvedValue({ waybill: "AWB123", trackingUrl: "u" });
    orderEventCreate.mockRejectedValue(new Error("db down"));

    await expect(autoCreateShipment("order_1")).resolves.toBeUndefined();
  });
});
