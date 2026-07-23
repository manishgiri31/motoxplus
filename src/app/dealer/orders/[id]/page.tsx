import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/utils";

export default async function OrderDetailPage(
  props: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ success?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const session = await getServerSession(authOptions);
  const dealer = await prisma.dealer.findUnique({ where: { userId: session!.user.id } });

  if (!dealer) return null;

  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: {
      items: { include: { product: { include: { category: true } } } },
      payments: true,
      invoice: true,
    },
  });

  if (!order || order.dealerId !== dealer.id) notFound();

  return (
    <div className="max-w-4xl mx-auto">
      {searchParams.success && (
        <div className="mb-6 bg-green-900/20 border border-green-700/30 rounded-sm p-4 text-green-400">
          ✓ Payment successful! Your order has been confirmed and invoice generated.
        </div>
      )}

      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight font-mono">
            {order.orderNumber}
          </h1>
          <p className="text-[var(--text-muted)] mt-1">Placed on {formatDate(order.createdAt)}</p>
        </div>
        <div className="text-right">
          <span className={`text-xs font-semibold uppercase tracking-wider px-3 py-1.5 rounded-sm ${
            order.status === "DELIVERED" ? "bg-green-900/20 text-green-400" :
            order.status === "PENDING" ? "bg-yellow-900/20 text-yellow-400" :
            order.status === "CONFIRMED" ? "bg-blue-900/20 text-blue-400" :
            "bg-gray-900/20 text-[var(--text-muted)]"
          }`}>
            {order.status}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Items */}
        <div className="lg:col-span-2">
          <div className="glass border border-white/5 rounded-sm overflow-hidden mb-6">
            <div className="px-6 py-4 border-b border-white/5">
              <h3 className="text-[var(--text-primary)] font-bold">Order Items</h3>
            </div>
            {order.items.map((item) => (
              <div key={item.id} className="flex items-center gap-4 px-6 py-4 border-b border-white/5 last:border-0">
                <div className="w-12 h-12 bg-gradient-to-br from-zinc-900 to-black rounded-sm flex items-center justify-center flex-shrink-0">
                  {item.product.images[0] ? (
                    <img src={item.product.images[0]} alt={item.product.name} className="w-full h-full object-cover rounded-sm" />
                  ) : (
                    <div className="text-xl text-red-900/30">◈</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[var(--text-primary)] font-bold text-sm truncate">{item.product.name}</div>
                  <div className="text-[var(--text-muted)] text-xs font-mono">{item.product.partNumber}</div>
                  <div className="text-gray-600 text-xs">{item.product.category.name}</div>
                </div>
                <div className="text-right">
                  <div className="text-[var(--text-muted)] text-xs mb-1">× {item.quantity}</div>
                  <div className="text-[var(--text-primary)] font-bold text-sm">{formatCurrency(item.total)}</div>
                  <div className="text-gray-600 text-[10px]">incl. GST</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Summary */}
        <div className="space-y-4">
          <div className="glass border border-white/5 rounded-sm p-6">
            <h3 className="text-[var(--text-primary)] font-bold mb-4">Payment Summary</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Subtotal</span>
                <span className="text-[var(--text-primary)]">{formatCurrency(order.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">GST</span>
                <span className="text-[var(--text-primary)]">{formatCurrency(order.gstAmount)}</span>
              </div>
              <div className="flex justify-between border-t border-white/10 pt-3 font-bold">
                <span className="text-[var(--text-primary)]">Grand Total</span>
                <span className="text-[var(--text-primary)]">{formatCurrency(order.grandTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Paid</span>
                <span className="text-green-400">{formatCurrency(order.amountPaid)}</span>
              </div>
              {order.amountDue > 0 && (
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Balance Due</span>
                  <span className="text-yellow-400">{formatCurrency(order.amountDue)}</span>
                </div>
              )}
            </div>
            <div className="mt-4 pt-4 border-t border-white/10">
              <div className="flex justify-between text-xs">
                <span className="text-[var(--text-muted)]">Payment Type</span>
                <span className="text-[var(--text-primary)] font-semibold">
                  {order.paymentType === "ADVANCE_20" ? "20% Advance" : "Full Payment"}
                </span>
              </div>
              <div className="flex justify-between text-xs mt-2">
                <span className="text-[var(--text-muted)]">Payment Status</span>
                <span className={`font-semibold ${
                  order.paymentStatus === "PAID" ? "text-green-400" :
                  order.paymentStatus === "PARTIAL" ? "text-yellow-400" :
                  "text-[var(--text-muted)]"
                }`}>
                  {order.paymentStatus}
                </span>
              </div>
            </div>
          </div>

          {order.invoice && (
            <Link
              href={`/dealer/invoices/${order.invoice.id}`}
              className="w-full block text-center bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-sm transition-colors text-sm uppercase tracking-wider"
            >
              Download Invoice
            </Link>
          )}

          <Link
            href="/dealer/orders"
            className="w-full block text-center glass border border-white/10 hover:border-red-900/40 text-[var(--text-secondary)] font-bold py-3 rounded-sm transition-colors text-sm"
          >
            ← Back to Orders
          </Link>
        </div>
      </div>
    </div>
  );
}
