import { describe, it, expect, vi, beforeEach } from "vitest";

const submitB2bManifestMock = vi.fn();
vi.mock("./manifest", () => ({ submitB2bManifest: (...a: unknown[]) => submitB2bManifestMock(...a) }));

const buildInputMock = vi.fn();
vi.mock("./order-mapping", () => ({ buildB2bManifestInput: (...a: unknown[]) => buildInputMock(...a) }));

const txMock = {
  $queryRaw: vi.fn(),
  orderEvent: { findFirst: vi.fn(), create: vi.fn() },
  order: { findUnique: vi.fn() },
};
vi.mock("@/lib/prisma", () => ({
  prisma: { $transaction: (fn: (tx: typeof txMock) => unknown) => fn(txMock) },
}));

const { createB2bShipment, B2B_MANIFEST_EVENT } = await import("./shipment");

const ORDER = {
  id: "o1",
  orderNumber: "MX-1",
  channel: "B2B",
  status: "CONFIRMED",
  amountDue: 0,
  items: [{ quantity: 2, product: { packageWeight: 1.5, weight: 1 } }],
};

beforeEach(() => {
  vi.clearAllMocks();
  txMock.$queryRaw.mockResolvedValue([]);
  txMock.orderEvent.findFirst.mockResolvedValue(null);
  txMock.orderEvent.create.mockResolvedValue({});
  txMock.order.findUnique.mockResolvedValue({ ...ORDER });
  buildInputMock.mockReturnValue({ built: true });
  submitB2bManifestMock.mockResolvedValue({ jobId: "job-9" });
});

describe("createB2bShipment", () => {
  it("takes the advisory lock, submits the manifest and records the job_id on the timeline", async () => {
    const r = await createB2bShipment("o1");

    expect(r).toEqual({ jobId: "job-9", alreadySubmitted: false });
    expect(buildInputMock).toHaveBeenCalledWith({ orderNumber: "MX-1", amountDue: 0, totalWeightKg: 3 });
    expect(submitB2bManifestMock).toHaveBeenCalledWith({ built: true });
    expect(txMock.orderEvent.create).toHaveBeenCalledWith({
      data: { orderId: "o1", type: B2B_MANIFEST_EVENT, reason: "job_id=job-9" },
    });
    expect(txMock.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(submitB2bManifestMock.mock.invocationCallOrder[0]);
  });

  it("is idempotent: a recorded manifest returns its job_id without a second submit", async () => {
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

  it("when the manifest structure is unspecified, nothing is submitted and no marker is written", async () => {
    buildInputMock.mockImplementation(() => {
      throw new Error("not specified");
    });
    await expect(createB2bShipment("o1")).rejects.toThrow("not specified");
    expect(submitB2bManifestMock).not.toHaveBeenCalled();
    expect(txMock.orderEvent.create).not.toHaveBeenCalled();
  });
});
