import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const sendTemplate = vi.fn();
vi.mock("./send-template", () => ({ sendTemplate: (...a: unknown[]) => sendTemplate(...a) }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }));
vi.mock("@/lib/delhivery/serviceability", () => ({
  checkServiceability: vi.fn(async () => ({ estimatedDeliveryDays: null })),
}));

// One mutable order row; updateMany emulates the conditional flag claim.
let order: any;
vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: {
      findUnique: vi.fn(async () => order),
      async updateMany({ where, data }: any) {
        const [flagKey] = Object.keys(where).filter((k) => k !== "id");
        if (flagKey && order[flagKey] !== where[flagKey]) return { count: 0 };
        Object.assign(order, data);
        return { count: 1 };
      },
    },
  },
}));

const { notifyOrderWhatsApp, isShippedCarrierStatus, buildTemplateValues } = await import("./order-notifications");

function makeOrder(over: Record<string, unknown> = {}) {
  return {
    id: "o1",
    orderNumber: "MX-1042",
    status: "CONFIRMED",
    deliveryName: "Asha Rao",
    deliveryPhone: "98765 43210",
    deliveryPincode: null,
    confirmationSentAt: null,
    cancelNotifiedAt: null,
    shippedNotifiedAt: null,
    items: [
      { quantity: 2, cancelledQuantity: 0, product: { name: "Brake Pad" } },
      { quantity: 1, cancelledQuantity: 1, product: { name: "Cancelled Thing" } },
    ],
    shipment: { waybill: "5793081", expectedDelivery: new Date("2026-11-10T06:00:00Z") },
    cancellation: null,
    customer: null,
    dealer: null,
    ...over,
  };
}

beforeEach(() => {
  vi.stubEnv("WHATSAPP_ORDER_NOTIFICATIONS", "true");
  sendTemplate.mockReset().mockResolvedValue({ messageId: "wamid" });
  order = makeOrder();
});
afterEach(() => vi.unstubAllEnvs());

describe("isShippedCarrierStatus", () => {
  it("matches In Transit / Dispatched exactly, ignoring case and whitespace", () => {
    expect(isShippedCarrierStatus("In Transit")).toBe(true);
    expect(isShippedCarrierStatus(" dispatched ")).toBe(true);
  });
  it("rejects everything else, including near-misses", () => {
    for (const s of ["Not Picked", "Manifested", "In Transit - Delayed", "Delivered", "", null, undefined]) {
      expect(isShippedCarrierStatus(s)).toBe(false);
    }
  });
});

describe("notifyOrderWhatsApp", () => {
  it("is a no-op unless WHATSAPP_ORDER_NOTIFICATIONS=true", async () => {
    vi.stubEnv("WHATSAPP_ORDER_NOTIFICATIONS", "");
    await notifyOrderWhatsApp("o1", "ORDER_CONFIRMED");
    expect(sendTemplate).not.toHaveBeenCalled();
  });

  it("sends order_confirmed once, with a normalized number and live items only", async () => {
    await notifyOrderWhatsApp("o1", "ORDER_CONFIRMED");
    await notifyOrderWhatsApp("o1", "ORDER_CONFIRMED");

    expect(sendTemplate).toHaveBeenCalledTimes(1);
    const [phone, template, values] = sendTemplate.mock.calls[0];
    expect(phone).toBe("919876543210");
    expect(template).toBe("order_confirmed");
    expect(values.slice(0, 3)).toEqual(["Asha Rao", "MX-1042", "Brake Pad x2"]);
    expect(order.confirmationSentAt).toBeInstanceOf(Date);
  });

  it("only one of two concurrent triggers sends", async () => {
    await Promise.all([notifyOrderWhatsApp("o1", "ORDER_SHIPPED"), notifyOrderWhatsApp("o1", "ORDER_SHIPPED")]);
    expect(sendTemplate).toHaveBeenCalledTimes(1);
  });

  it("defaults the cancel reason, uses the recorded one when present, and flags carrier cancels", async () => {
    order = makeOrder({ cancellation: { reason: null } });
    expect((await buildTemplateValues(order, "ORDER_CANCELLED"))[2]).toBe("Requested by customer");
    order = makeOrder({ cancellation: { reason: "Wrong part" } });
    expect((await buildTemplateValues(order, "ORDER_CANCELLED"))[2]).toBe("Wrong part");
    order = makeOrder({ cancellation: null });
    expect((await buildTemplateValues(order, "ORDER_CANCELLED"))[2]).toBe("Shipment cancelled by the courier");
  });

  it("builds order_shipped values from the shipment (Delhivery, AWB, expected date)", async () => {
    const values = await buildTemplateValues(order, "ORDER_SHIPPED");
    expect(values.slice(0, 4)).toEqual(["Asha Rao", "MX-1042", "Delhivery", "5793081"]);
    expect(values[4]).toMatch(/2026/);
  });

  it("does not throw when the send fails, and releases the flag so it can retry", async () => {
    sendTemplate.mockRejectedValueOnce(new Error("boom"));
    await expect(notifyOrderWhatsApp("o1", "ORDER_CONFIRMED")).resolves.toBeUndefined();
    expect(order.confirmationSentAt).toBeNull();

    await notifyOrderWhatsApp("o1", "ORDER_CONFIRMED");
    expect(sendTemplate).toHaveBeenCalledTimes(2);
    expect(order.confirmationSentAt).toBeInstanceOf(Date);
  });

  it("skips (without claiming the flag) when there is no valid phone", async () => {
    order = makeOrder({ deliveryPhone: "123" });
    await notifyOrderWhatsApp("o1", "ORDER_CONFIRMED");
    expect(sendTemplate).not.toHaveBeenCalled();
    expect(order.confirmationSentAt).toBeNull();
  });

  it("never sends 'shipped' for a delivered/cancelled order or one with no AWB", async () => {
    for (const over of [{ status: "DELIVERED" }, { status: "CANCELLED" }, { shipment: null }]) {
      order = makeOrder(over);
      await notifyOrderWhatsApp("o1", "ORDER_SHIPPED");
    }
    expect(sendTemplate).not.toHaveBeenCalled();
  });
});
