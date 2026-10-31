import { describe, it, expect, vi, beforeEach } from "vitest";

const submitB2bManifestMock = vi.fn();
vi.mock("./manifest", () => ({ submitB2bManifest: (...a: unknown[]) => submitB2bManifestMock(...a) }));

const buildInputMock = vi.fn();
const boxCountMock = vi.fn();
vi.mock("./order-mapping", () => ({
  buildB2bManifestInput: (...a: unknown[]) => buildInputMock(...a),
  b2bBoxCount: (...a: unknown[]) => boxCountMock(...a),
}));

const txMock = {
  $queryRaw: vi.fn(),
  orderEvent: { findFirst: vi.fn(), create: vi.fn() },
  order: { findUnique: vi.fn() },
};
const eventFindMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: (fn: (tx: typeof txMock) => unknown) => fn(txMock),
    orderEvent: { findMany: (...a: unknown[]) => eventFindMany(...a) },
  },
}));

const { createB2bShipment, getB2bWaitingPackages, orderToB2bFacts, B2B_MANIFEST_EVENT } = await import("./shipment");

const ORDER = {
  id: "o1",
  orderNumber: "MX-1",
  channel: "B2B",
  status: "CONFIRMED",
  grandTotal: 5000,
  amountDue: 4000,
  deliveryName: "Dealer Co",
  shippingAddress: "12 Main Rd",
  deliveryCity: "Hisar",
  deliveryState: "Haryana",
  deliveryPincode: "125001",
  deliveryPhone: "+91 98765-43210",
  dealer: {
    ownerName: "Owner",
    address: "dealer addr",
    city: "dealer city",
    state: "dealer state",
    pincode: "000000",
    phone: "1111111111",
    user: { email: "dealer@example.com" },
  },
  customer: null,
  items: [
    { quantity: 2, product: { name: "Mudguard", packageWeight: 1.5, weight: 1 } },
    { quantity: 1, product: { name: "Cable", packageWeight: null, weight: null } },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  txMock.$queryRaw.mockResolvedValue([]);
  txMock.orderEvent.findFirst.mockResolvedValue(null);
  txMock.orderEvent.create.mockResolvedValue({});
  txMock.order.findUnique.mockResolvedValue({ ...ORDER });
  buildInputMock.mockReturnValue({ built: true, shipmentDetails: [{ box_count: 1 }] });
  boxCountMock.mockReturnValue(1);
  submitB2bManifestMock.mockResolvedValue({ jobId: "job-9" });
});

describe("orderToB2bFacts", () => {
  it("uses the order's delivery fields, a 10-digit phone, and weights with a 0.5kg fallback", () => {
    const f = orderToB2bFacts(ORDER as never);
    expect(f).toEqual({
      orderNumber: "MX-1",
      grandTotal: 5000,
      amountDue: 4000,
      consignee: {
        name: "Dealer Co",
        address: "12 Main Rd",
        city: "Hisar",
        state: "Haryana",
        pincode: "125001",
        phone: "9876543210",
        email: "dealer@example.com",
      },
      items: [
        { name: "Mudguard", quantity: 2, weightKg: 1.5 },
        { name: "Cable", quantity: 1, weightKg: 0.5 },
      ],
    });
  });

  it("falls back to the dealer profile for a missing delivery field", () => {
    const f = orderToB2bFacts({ ...ORDER, deliveryCity: null, deliveryState: "" } as never);
    expect(f.consignee.city).toBe("dealer city");
    expect(f.consignee.state).toBe("dealer state");
  });

  it("sends an empty email (not the fake one) for a placeholder address", () => {
    const f = orderToB2bFacts({
      ...ORDER,
      dealer: null,
      customer: { user: { email: "9876543210@phone.motoxplus.invalid" } },
    } as never);
    expect(f.consignee.email).toBe("");
  });

  it("refuses an order without a complete delivery address", () => {
    expect(() => orderToB2bFacts({ ...ORDER, shippingAddress: null, dealer: { ...ORDER.dealer, address: "" } } as never)).toThrow(
      /no complete delivery/
    );
  });
});

describe("createB2bShipment", () => {
  it("takes the advisory lock, submits the built manifest and records the job_id on the timeline", async () => {
    const r = await createB2bShipment("o1");

    expect(r).toEqual({ jobId: "job-9", alreadySubmitted: false });
    expect(buildInputMock).toHaveBeenCalledWith(expect.objectContaining({ orderNumber: "MX-1", amountDue: 4000 }));
    expect(submitB2bManifestMock).toHaveBeenCalledWith({ built: true, shipmentDetails: [{ box_count: 1 }] });
    expect(txMock.orderEvent.create).toHaveBeenCalledWith({
      data: { orderId: "o1", type: B2B_MANIFEST_EVENT, reason: "job_id=job-9;boxes=1" },
    });
    expect(txMock.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(submitB2bManifestMock.mock.invocationCallOrder[0]);
  });

  it("is idempotent: a recorded manifest returns its job_id without a second submit (new and legacy marker formats)", async () => {
    txMock.orderEvent.findFirst.mockResolvedValue({ reason: "job_id=job-1;boxes=2" });
    expect((await createB2bShipment("o1")).jobId).toBe("job-1");
    txMock.orderEvent.findFirst.mockResolvedValue({ reason: "job_id=job-1" });

    const r = await createB2bShipment("o1");

    expect(r).toEqual({ jobId: "job-1", alreadySubmitted: true });
    expect(submitB2bManifestMock).not.toHaveBeenCalled();
  });

  it("refuses a non-B2B order (wrong module) and a PENDING order", async () => {
    txMock.order.findUnique.mockResolvedValueOnce({ ...ORDER, channel: "B2C" });
    await expect(createB2bShipment("o1")).rejects.toThrow(/not B2B/);
    txMock.order.findUnique.mockResolvedValueOnce({ ...ORDER, status: "PENDING" });
    await expect(createB2bShipment("o1")).rejects.toThrow(/PENDING/);
    expect(submitB2bManifestMock).not.toHaveBeenCalled();
  });

  it("when the manifest is refused (e.g. prod gate), no job_id marker is written", async () => {
    submitB2bManifestMock.mockRejectedValue(new Error("blocked on prod"));
    await expect(createB2bShipment("o1")).rejects.toThrow("blocked on prod");
    expect(txMock.orderEvent.create).not.toHaveBeenCalled();
  });
});

describe("getB2bWaitingPackages", () => {
  it("sums box_count over the manifests since the cutoff; a legacy marker (no boxes) counts as 1", async () => {
    eventFindMany.mockResolvedValue([{ reason: "job_id=a;boxes=2" }, { reason: "job_id=b;boxes=1" }, { reason: "job_id=c" }]);
    const since = new Date("2026-11-01T10:00:00Z");

    expect(await getB2bWaitingPackages(since)).toBe(4);
    expect(eventFindMany).toHaveBeenCalledWith({
      where: { type: B2B_MANIFEST_EVENT, createdAt: { gte: since } },
      select: { reason: true },
    });
  });

  it("is 0 when nothing is waiting", async () => {
    eventFindMany.mockResolvedValue([]);
    expect(await getB2bWaitingPackages(new Date())).toBe(0);
  });
});
