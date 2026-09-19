import type { Prisma, OrderChannel } from "@prisma/client";
import { generateInvoiceNumber } from "@/lib/utils";

interface InvoiceOrderInput {
  id: string;
  dealerId: string;
  subtotal: number;
  gstAmount: number;
  grandTotal: number;
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
      subtotal: params.order.subtotal,
      gstAmount: params.order.gstAmount,
      grandTotal: params.order.grandTotal,
      channel: params.channel,
    },
  });
  return { invoiceNumber };
}
