import { prisma } from "@/lib/prisma";
import { autoCreateShipment } from "@/lib/delhivery";
import { decrementStock } from "@/lib/orders/stock";
import { notifyOrderEvent } from "@/lib/push/order-notifications";
import { createInvoice } from "@/lib/invoicing/create-invoice";
import { checkServiceability } from "@/lib/delhivery/serviceability";

export const COD_UNAVAILABLE_MESSAGE =
  "Cash on Delivery isn't available for this pincode. Please pay online instead.";

/** True only when Delhivery confirms COD for the pincode — a lookup failure
 *  counts as "no", since a COD order for an unreachable pincode can't ship. */
export async function isCodAvailable(pincode: string): Promise<boolean> {
  const result = await checkServiceability(pincode);
  return result.availableServices.includes("COD");
}

/**
 * Turns an unpaid B2C order into a confirmed Cash-on-Delivery order, exactly
 * once: reserves stock, writes the invoice and then (fire-and-forget) books the
 * Delhivery shipment and notifies — the same transition
 * lib/payments/finalize.ts performs when an online payment lands, minus the
 * money. Nothing is paid yet, so amountDue stays at grandTotal and
 * createDelhiveryShipment derives payment_mode COD / cod_amount from it.
 *
 * Idempotent via the `stockReserved: false` guard (a double submit, or a
 * retry after "Pay Online" was dismissed, can never reserve stock twice).
 * Throws InsufficientStockError when the last unit sold in between; the
 * transaction rolls back and the order is left PENDING.
 */
export async function confirmCodOrder(orderId: string): Promise<{ confirmed: boolean }> {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order) throw new Error(`Order ${orderId} not found while confirming COD`);

  let confirmed = false;
  await prisma.$transaction(async (tx) => {
    const guarded = await tx.order.updateMany({
      where: { id: orderId, channel: "B2C", status: "PENDING", stockReserved: false, paymentStatus: "PENDING" },
      data: {
        paymentType: "COD",
        status: "CONFIRMED",
        stockReserved: true,
        amountPaid: 0,
        amountDue: order.grandTotal,
      },
    });
    if (guarded.count === 0) return;

    await decrementStock(
      tx,
      order.items.map((item) => ({ productId: item.productId, variantId: item.variantId, quantity: item.quantity }))
    );

    await createInvoice(tx, {
      order: {
        id: orderId,
        dealerId: order.dealerId,
        customerId: order.customerId,
        subtotal: order.subtotal,
        gstAmount: order.gstAmount,
        grandTotal: order.grandTotal,
        cgstAmount: order.cgstAmount,
        sgstAmount: order.sgstAmount,
        igstAmount: order.igstAmount,
        placeOfSupply: order.placeOfSupply,
      },
      channel: order.channel,
    });
    confirmed = true;
  });

  if (confirmed) {
    void autoCreateShipment(orderId);
    void notifyOrderEvent(orderId, "ORDER_CONFIRMED");
  }
  return { confirmed };
}
