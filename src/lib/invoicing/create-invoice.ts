import type { Prisma, OrderChannel } from "@prisma/client";
import { generateInvoiceNumber } from "@/lib/utils";

interface InvoiceOrderInput {
  id: string;
  dealerId: string | null;
  customerId: string | null;
  subtotal: number;
  gstAmount: number;
  grandTotal: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  placeOfSupply: string | null;
}

/**
 * Single place that writes an Invoice row. Both /api/payments/verify (via
 * lib/payments/finalize.ts, Razorpay) and /api/admin/payments/[id]/verify
 * (manual UPI verification) call this from inside their own transaction.
 *
 * Each caller keeps its own idempotency guard — finalize.ts relies on the
 * order's stockReserved state-transition guard, the admin route checks
 * `!order.invoice` — this function only builds and inserts the row, so
 * those two guards can't drift into divergent invoice-shape behavior.
 *
 * cgst/sgst/igst/placeOfSupply are copied from the Order, not recomputed —
 * the split was already derived once at order-creation time (see
 * lib/tax/gst-split.ts and POST /api/orders) from the delivery state that
 * was current then. Re-deriving here could disagree if the seller-state
 * setting changed in between.
 *
 * dealerId/customerId are carried straight from the Order — exactly one is
 * set (B2C-EXPANSION-PLAN.md Phase 2's owner-exactly-one CHECK), never
 * re-derived from channel here.
 */
export async function createInvoice(
  tx: Prisma.TransactionClient,
  params: { order: InvoiceOrderInput; channel: OrderChannel }
): Promise<{ invoiceNumber: string }> {
  const invoiceNumber = generateInvoiceNumber();
  await tx.invoice.create({
    data: {
      invoiceNumber,
      orderId: params.order.id,
      dealerId: params.order.dealerId,
      customerId: params.order.customerId,
      subtotal: params.order.subtotal,
      gstAmount: params.order.gstAmount,
      grandTotal: params.order.grandTotal,
      cgstAmount: params.order.cgstAmount,
      sgstAmount: params.order.sgstAmount,
      igstAmount: params.order.igstAmount,
      placeOfSupply: params.order.placeOfSupply,
      channel: params.channel,
    },
  });
  return { invoiceNumber };
}
