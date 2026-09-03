import { prisma } from "@/lib/prisma";
import { generateInvoiceNumber, roundToPaise } from "@/lib/utils";
import { autoCreateShipment } from "@/lib/delhivery";
import { decrementStock } from "@/lib/orders/stock";
import { notifyOrderEvent } from "@/lib/push/order-notifications";

export interface FinalizeCapturedPaymentResult {
  /** false only for the single call that actually performed the transition. */
  alreadyProcessed: boolean;
  invoiceNumber: string | null;
}

/**
 * Marks a Payment PAID and, exactly once, transitions its Order to
 * paid/confirmed, decrements stock, and generates the invoice.
 *
 * Both /api/payments/verify (client callback, after its own HMAC + Razorpay
 * capture-fetch checks) and the payment.captured/order.paid webhook (after
 * its own raw-body HMAC check) call this once they've independently
 * confirmed the payment — whichever call arrives first is the one that
 * actually mutates state via the `stockReserved: false` guard; the other
 * (webhook arriving after verify already ran, or vice versa, or a Razorpay
 * webhook retry) is a safe no-op that just returns the already-created
 * invoice number. This is the single code path for that transition so the
 * two entry points can't drift into divergent idempotency behavior.
 */
export async function finalizeCapturedPayment(params: {
  paymentId: string;
  orderId: string;
  razorpayPaymentId: string;
  razorpaySignature?: string | null;
}): Promise<FinalizeCapturedPaymentResult> {
  const { paymentId, orderId, razorpayPaymentId, razorpaySignature } = params;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!order) throw new Error(`Order ${orderId} not found during payment finalization`);

  const isFullPayment = order.paymentType === "FULL_100";
  let invoiceNumber: string | null = null;

  await prisma.$transaction(async (tx) => {
    // F-05: the Payment→PAID write lives INSIDE this transaction, so a
    // rollback (most concretely: decrementStock throwing InsufficientStockError
    // when the last unit sold between capture and finalize) also un-does it.
    // Previously this ran before the transaction and stayed committed on
    // rollback → money reads captured, order stuck PENDING forever, every
    // webhook redelivery a no-op on status==="PAID". The `status: { not:
    // "PAID" }` guard still makes it a safe no-op for the second entry point
    // (verify vs webhook) that arrives after the first already finalized.
    await tx.payment.updateMany({
      where: { id: paymentId, status: { not: "PAID" } },
      data: {
        razorpayPaymentId,
        ...(razorpaySignature ? { razorpaySignature } : {}),
        status: "PAID",
      },
    });

    const guarded = await tx.order.updateMany({
      where: { id: orderId, stockReserved: false },
      data: {
        amountPaid: order.amountDue,
        amountDue: isFullPayment ? 0 : roundToPaise(order.grandTotal - order.amountDue),
        paymentStatus: isFullPayment ? "PAID" : "PARTIAL",
        status: "CONFIRMED",
        stockReserved: true,
      },
    });
    if (guarded.count === 0) return;

    await decrementStock(
      tx,
      order.items.map((item) => ({
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
      }))
    );

    invoiceNumber = generateInvoiceNumber();
    await tx.invoice.create({
      data: {
        invoiceNumber,
        orderId,
        dealerId: order.dealerId,
        subtotal: order.subtotal,
        gstAmount: order.gstAmount,
        grandTotal: order.grandTotal,
      },
    });
  });

  const alreadyProcessed = invoiceNumber === null;
  if (alreadyProcessed) {
    const existing = await prisma.invoice.findUnique({ where: { orderId } });
    return { alreadyProcessed: true, invoiceNumber: existing?.invoiceNumber ?? null };
  }

  // Only the call that actually made the PENDING -> CONFIRMED transition
  // triggers auto shipment creation. autoCreateShipment never throws (a
  // Delhivery outage must not un-finalize a captured payment), is gated by
  // DELHIVERY_AUTO_SHIPMENT, records the outcome on OrderEvent, and is itself
  // idempotent (advisory lock + unique constraint in createDelhiveryShipment).
  void autoCreateShipment(orderId);

  // Only the call that actually performed the PENDING -> CONFIRMED transition
  // notifies the dealer (fire-and-forget; notifyOrderEvent never throws).
  void notifyOrderEvent(orderId, "ORDER_CONFIRMED");

  return { alreadyProcessed: false, invoiceNumber };
}
