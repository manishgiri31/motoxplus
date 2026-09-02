import { describe, it, expect, vi, beforeEach } from "vitest";

// F-05: the Payment→PAID write must happen INSIDE finalize's $transaction, so a
// rollback (InsufficientStockError when the last unit sold between capture and
// finalize) also un-does it — instead of leaving money "captured" against an
// order that stays PENDING forever with every webhook redelivery a no-op.

const decrementStockMock = vi.fn();
vi.mock("@/lib/orders/stock", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/orders/stock")>();
  return { ...actual, decrementStock: (...a: unknown[]) => decrementStockMock(...a) };
});

vi.mock("@/lib/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/utils")>();
  return { ...actual, generateInvoiceNumber: () => "INV-TEST-1" };
});

const createDelhiveryShipmentMock = vi.fn().mockResolvedValue({ waybill: "x", trackingUrl: "y" });
vi.mock("@/lib/delhivery", () => ({
  createDelhiveryShipment: (...a: unknown[]) => createDelhiveryShipmentMock(...a),
}));

const notifyOrderEventMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/push/order-notifications", () => ({
  notifyOrderEvent: (...a: unknown[]) => notifyOrderEventMock(...a),
}));

const txMock = {
  payment: { updateMany: vi.fn() },
  order: { updateMany: vi.fn() },
  invoice: { create: vi.fn() },
};
const prismaMock = {
  order: { findUnique: vi.fn() },
  payment: { updateMany: vi.fn() }, // the top-level client — a write here would SURVIVE a rollback
  invoice: { findUnique: vi.fn() },
  $transaction: vi.fn(async (cb: (tx: typeof txMock) => unknown) => cb(txMock)),
};
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const { finalizeCapturedPayment } = await import("./finalize");
const { InsufficientStockError } = await import("@/lib/orders/stock");

const ORDER = {
  id: "o1",
  dealerId: "d1",
  paymentType: "FULL_100",
  amountDue: 1000,
  grandTotal: 1000,
  subtotal: 900,
  gstAmount: 100,
  items: [{ productId: "p1", variantId: null, quantity: 1 }],
};

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.$transaction.mockImplementation(async (cb: (tx: typeof txMock) => unknown) => cb(txMock));
  prismaMock.order.findUnique.mockResolvedValue({ ...ORDER });
  txMock.order.updateMany.mockResolvedValue({ count: 1 });
  txMock.invoice.create.mockResolvedValue({});
  decrementStockMock.mockResolvedValue(undefined);
});

describe("finalizeCapturedPayment — F-05 (Payment→PAID inside the transaction)", () => {
  it("writes Payment PAID on the transaction client, never on the top-level prisma client", async () => {
    await finalizeCapturedPayment({ paymentId: "pay1", orderId: "o1", razorpayPaymentId: "rzp_1" });

    expect(txMock.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "pay1", status: { not: "PAID" } },
        data: expect.objectContaining({ status: "PAID", razorpayPaymentId: "rzp_1" }),
      })
    );
    expect(prismaMock.payment.updateMany).not.toHaveBeenCalled();
  });

  it("does NOT leave the payment PAID when the transaction rolls back (stock sold out)", async () => {
    decrementStockMock.mockRejectedValue(new InsufficientStockError("p1", null));
    // a real $transaction re-throws whatever the callback threw, after rolling back
    prismaMock.$transaction.mockImplementation(async (cb: (tx: typeof txMock) => unknown) => cb(txMock));

    await expect(
      finalizeCapturedPayment({ paymentId: "pay1", orderId: "o1", razorpayPaymentId: "rzp_1" })
    ).rejects.toBeInstanceOf(InsufficientStockError);

    // The only PAID write was on the tx client — it rolls back with the transaction.
    // Nothing was written on the top-level client that would outlive the rollback.
    expect(prismaMock.payment.updateMany).not.toHaveBeenCalled();
    expect(createDelhiveryShipmentMock).not.toHaveBeenCalled();
    expect(notifyOrderEventMock).not.toHaveBeenCalled();
  });

  it("happy path still confirms the order and returns the invoice number", async () => {
    const res = await finalizeCapturedPayment({ paymentId: "pay1", orderId: "o1", razorpayPaymentId: "rzp_1" });
    expect(res).toEqual({ alreadyProcessed: false, invoiceNumber: "INV-TEST-1" });
    expect(txMock.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "o1", stockReserved: false }, data: expect.objectContaining({ status: "CONFIRMED" }) })
    );
  });

  it("second caller (order already finalized) is a safe no-op returning the existing invoice", async () => {
    txMock.order.updateMany.mockResolvedValue({ count: 0 }); // guard matched nothing — someone else won
    prismaMock.invoice.findUnique.mockResolvedValue({ invoiceNumber: "INV-EXISTING" });

    const res = await finalizeCapturedPayment({ paymentId: "pay1", orderId: "o1", razorpayPaymentId: "rzp_1" });

    expect(res).toEqual({ alreadyProcessed: true, invoiceNumber: "INV-EXISTING" });
    expect(decrementStockMock).not.toHaveBeenCalled();
    expect(createDelhiveryShipmentMock).not.toHaveBeenCalled();
  });
});
