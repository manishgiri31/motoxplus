import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/utils";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileText, Download, Package } from "lucide-react";

const paymentStatusColors: Record<string, string> = {
  PENDING: "bg-yellow-900/20 text-yellow-400",
  PARTIAL: "bg-blue-900/20 text-blue-400",
  PAID: "bg-green-900/20 text-green-400",
  REFUNDED: "bg-purple-900/20 text-purple-400",
  FAILED: "bg-red-900/20 text-red-400",
};

export default async function AdminInvoiceDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const invoice = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: {
      dealer: true,
      order: {
        include: {
          items: {
            include: {
              product: { select: { name: true, partNumber: true, sku: true } },
            },
          },
          payments: { orderBy: { createdAt: "desc" } },
        },
      },
    },
  });

  if (!invoice) notFound();

  const { order, dealer } = invoice;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <Link
            href="/admin/invoices"
            className="inline-flex items-center gap-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] text-sm mb-3 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Invoices
          </Link>
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-[var(--text-muted)]" />
            <h1 className="text-2xl font-black text-[var(--text-primary)] tracking-tight font-mono">
              {invoice.invoiceNumber}
            </h1>
            <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-sm ${paymentStatusColors[order.paymentStatus] ?? "bg-gray-900/20 text-[var(--text-muted)]"}`}>
              {order.paymentStatus}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {invoice.pdfUrl && (
            <a
              href={invoice.pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-sm transition-colors"
            >
              <Download className="w-4 h-4" />
              Download PDF
            </a>
          )}
          <Link
            href={`/admin/orders/${invoice.orderId}`}
            className="px-4 py-2 glass border border-[var(--border-color)] text-[var(--text-muted)] text-sm rounded-sm hover:border-red-600/50 transition-colors"
          >
            View Order
          </Link>
        </div>
      </div>

      {/* Invoice card */}
      <div className="glass border border-[var(--border-color)] rounded-sm overflow-hidden">
        {/* Invoice meta */}
        <div className="grid grid-cols-2 gap-6 px-6 py-5 border-b border-[var(--border-color)]">
          <div>
            <p className="text-[var(--text-muted)] text-xs uppercase tracking-widest mb-3">Bill To</p>
            <p className="text-[var(--text-primary)] font-bold text-sm">{dealer.companyName}</p>
            <p className="text-[var(--text-muted)] text-xs mt-0.5">{dealer.ownerName}</p>
            <p className="text-[var(--text-muted)] text-xs mt-0.5">{dealer.address}</p>
            <p className="text-[var(--text-muted)] text-xs mt-0.5">
              {[dealer.city, dealer.state, dealer.pincode].filter(Boolean).join(", ")}
            </p>
            <p className="text-[var(--text-muted)] text-xs mt-1">GST: {dealer.gstNumber}</p>
            <p className="text-[var(--text-muted)] text-xs mt-0.5">Ph: {dealer.phone}</p>
          </div>
          <div className="text-right">
            <p className="text-[var(--text-muted)] text-xs uppercase tracking-widest mb-3">Invoice Details</p>
            <div className="space-y-1">
              <div>
                <span className="text-[var(--text-muted)] text-xs">Invoice No: </span>
                <span className="text-[var(--text-primary)] text-xs font-mono font-bold">{invoice.invoiceNumber}</span>
              </div>
              <div>
                <span className="text-[var(--text-muted)] text-xs">Order No: </span>
                <span className="text-[var(--text-secondary)] text-xs font-mono">{order.orderNumber}</span>
              </div>
              <div>
                <span className="text-[var(--text-muted)] text-xs">Issued: </span>
                <span className="text-[var(--text-secondary)] text-xs">{formatDate(invoice.issuedAt)}</span>
              </div>
              {invoice.dueDate && (
                <div>
                  <span className="text-[var(--text-muted)] text-xs">Due: </span>
                  <span className="text-[var(--text-secondary)] text-xs">{formatDate(invoice.dueDate)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Line items */}
        <div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border-color)] bg-white/2">
                <th className="px-6 py-3 text-left text-[10px] text-[var(--text-muted)] uppercase tracking-widest">Item</th>
                <th className="px-4 py-3 text-left text-[10px] text-[var(--text-muted)] uppercase tracking-widest hidden sm:table-cell">Part No.</th>
                <th className="px-4 py-3 text-right text-[10px] text-[var(--text-muted)] uppercase tracking-widest">Qty</th>
                <th className="px-4 py-3 text-right text-[10px] text-[var(--text-muted)] uppercase tracking-widest">Unit Price</th>
                <th className="px-4 py-3 text-right text-[10px] text-[var(--text-muted)] uppercase tracking-widest hidden sm:table-cell">GST</th>
                <th className="px-6 py-3 text-right text-[10px] text-[var(--text-muted)] uppercase tracking-widest">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {order.items.map((item) => (
                <tr key={item.id} className="hover:bg-white/2 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <Package className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0" />
                      <span className="text-[var(--text-primary)] text-sm font-medium">{item.product.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 hidden sm:table-cell">
                    <span className="text-[var(--text-muted)] text-xs font-mono">{item.product.partNumber}</span>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <span className="text-[var(--text-secondary)] text-sm">{item.quantity}</span>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <span className="text-[var(--text-secondary)] text-sm">{formatCurrency(item.unitPrice)}</span>
                  </td>
                  <td className="px-4 py-4 text-right hidden sm:table-cell">
                    <span className="text-[var(--text-muted)] text-xs">{item.gstRate}% / {formatCurrency(item.gstAmount)}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-[var(--text-primary)] text-sm font-bold">{formatCurrency(item.total)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="border-t border-[var(--border-color)] px-6 py-5">
          <div className="flex justify-end">
            <div className="w-64 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-[var(--text-muted)]">Subtotal</span>
                <span className="text-[var(--text-secondary)]">{formatCurrency(invoice.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[var(--text-muted)]">GST</span>
                <span className="text-[var(--text-secondary)]">{formatCurrency(invoice.gstAmount)}</span>
              </div>
              {order.shippingCost > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--text-muted)]">Shipping</span>
                  <span className="text-[var(--text-secondary)]">{formatCurrency(order.shippingCost)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold pt-2 border-t border-white/10">
                <span className="text-[var(--text-primary)]">Grand Total</span>
                <span className="text-[var(--text-primary)]">{formatCurrency(invoice.grandTotal)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Payment summary */}
        <div className="border-t border-[var(--border-color)] px-6 py-5 bg-white/2">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
            {/* Payment history */}
            {order.payments.length > 0 && (
              <div className="flex-1">
                <p className="text-[var(--text-muted)] text-xs uppercase tracking-widest mb-3">Payment History</p>
                <div className="space-y-2">
                  {order.payments.map((payment) => (
                    <div key={payment.id} className="flex items-center justify-between text-sm">
                      <div>
                        <span className="text-[var(--text-secondary)]">{formatCurrency(payment.amount)}</span>
                        <span className="text-[var(--text-muted)] text-xs ml-2">{payment.paymentType} · {formatDate(payment.createdAt)}</span>
                      </div>
                      <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-sm ${paymentStatusColors[payment.status] ?? "bg-gray-900/20 text-[var(--text-muted)]"}`}>
                        {payment.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Balance */}
            <div className="sm:text-right">
              <p className="text-[var(--text-muted)] text-xs uppercase tracking-widest mb-3">Balance</p>
              <div className="space-y-1">
                <div className="flex sm:justify-end gap-6 text-sm">
                  <span className="text-[var(--text-muted)]">Paid</span>
                  <span className="text-green-400 font-semibold">{formatCurrency(order.amountPaid)}</span>
                </div>
                <div className="flex sm:justify-end gap-6 text-sm">
                  <span className="text-[var(--text-muted)]">Due</span>
                  <span className={`font-bold ${order.amountDue > 0 ? "text-red-400" : "text-[var(--text-muted)]"}`}>
                    {formatCurrency(order.amountDue)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
