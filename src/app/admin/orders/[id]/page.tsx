import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/utils";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Package, Truck, FileText, CreditCard, MapPin } from "lucide-react";
import { AdminOrderStatus } from "@/components/admin/order-status";

const statusColors: Record<string, string> = {
  PENDING:    "bg-yellow-900/20 text-yellow-400 border-yellow-400/20",
  CONFIRMED:  "bg-blue-900/20 text-blue-400 border-blue-400/20",
  PROCESSING: "bg-purple-900/20 text-purple-400 border-purple-400/20",
  SHIPPED:    "bg-indigo-900/20 text-indigo-400 border-indigo-400/20",
  DELIVERED:  "bg-green-900/20 text-green-400 border-green-400/20",
  CANCELLED:  "bg-red-900/20 text-red-400 border-red-400/20",
};

const paymentColors: Record<string, string> = {
  PAID:    "text-green-400",
  PARTIAL: "text-yellow-400",
  PENDING: "text-[var(--text-muted)]",
  FAILED:  "text-red-400",
};

export default async function AdminOrderDetailPage({ params }: { params: { id: string } }) {
  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: {
      dealer: { include: { user: true } },
      items: { include: { product: { include: { productImages: { where: { isPrimary: true }, take: 1 } } } } },
      payments: { orderBy: { createdAt: "desc" } },
      invoice: true,
      shipment: true,
    },
  });

  if (!order) notFound();

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/admin/orders"
          className="inline-flex items-center gap-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] text-sm mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Orders
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-[var(--text-primary)] tracking-tight font-mono">
              {order.orderNumber}
            </h1>
            <p className="text-[var(--text-muted)] text-sm mt-1">{formatDate(order.createdAt)}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider border ${statusColors[order.status] ?? "bg-gray-900/20 text-[var(--text-muted)] border-white/10"}`}>
              {order.status}
            </span>
            <AdminOrderStatus orderId={order.id} currentStatus={order.status} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column — items + payments */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order items */}
          <div className="glass border border-[var(--border-color)] rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--border-color)] flex items-center gap-2">
              <Package className="w-4 h-4 text-[var(--text-muted)]" />
              <h2 className="font-semibold text-[var(--text-primary)] text-sm">Items ({order.items.length})</h2>
            </div>
            <div className="divide-y divide-white/5">
              {order.items.map((item) => {
                const img = item.product.productImages[0];
                return (
                  <div key={item.id} className="px-5 py-4 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-sm bg-white/5 border border-[var(--border-color)] overflow-hidden flex-shrink-0">
                      {img ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={img.thumbnailUrl ?? img.imageUrl} alt={item.product.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[var(--text-muted)]">
                          <Package className="w-5 h-5" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[var(--text-primary)] text-sm font-medium truncate">{item.product.name}</p>
                      <p className="text-[var(--text-muted)] text-xs">{item.product.partNumber}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-[var(--text-primary)] text-sm font-bold">{formatCurrency(item.total)}</p>
                      <p className="text-[var(--text-muted)] text-xs">{item.quantity} × {formatCurrency(item.unitPrice)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Totals */}
            <div className="border-t border-[var(--border-color)] px-5 py-4 space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-[var(--text-muted)]">Subtotal</span>
                <span className="text-[var(--text-secondary)]">{formatCurrency(order.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[var(--text-muted)]">GST</span>
                <span className="text-[var(--text-secondary)]">{formatCurrency(order.gstAmount)}</span>
              </div>
              {order.shippingCost > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--text-muted)]">Shipping</span>
                  <span className="text-[var(--text-secondary)]">{formatCurrency(order.shippingCost)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold pt-1.5 border-t border-white/5">
                <span className="text-[var(--text-primary)]">Total</span>
                <span className="text-[var(--text-primary)]">{formatCurrency(order.grandTotal)}</span>
              </div>
            </div>
          </div>

          {/* Payments */}
          {order.payments.length > 0 && (
            <div className="glass border border-[var(--border-color)] rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[var(--border-color)] flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-[var(--text-muted)]" />
                <h2 className="font-semibold text-[var(--text-primary)] text-sm">Payments</h2>
              </div>
              <div className="divide-y divide-white/5">
                {order.payments.map((payment) => (
                  <div key={payment.id} className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-[var(--text-primary)] text-sm font-medium">{formatCurrency(payment.amount)}</p>
                      <p className="text-[var(--text-muted)] text-xs">{payment.paymentType} · {formatDate(payment.createdAt)}</p>
                      {payment.razorpayPaymentId && (
                        <p className="text-[var(--text-muted)] text-xs font-mono mt-0.5">{payment.razorpayPaymentId}</p>
                      )}
                    </div>
                    <span className={`text-xs font-bold uppercase ${paymentColors[payment.status] ?? "text-[var(--text-muted)]"}`}>
                      {payment.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column — dealer, delivery, invoice */}
        <div className="space-y-4">
          {/* Payment summary */}
          <div className="glass border border-[var(--border-color)] rounded-xl p-4 space-y-2">
            <h2 className="font-semibold text-[var(--text-primary)] text-sm mb-3">Payment Summary</h2>
            <div className="flex justify-between text-sm">
              <span className="text-[var(--text-muted)]">Amount Paid</span>
              <span className="text-green-400 font-medium">{formatCurrency(order.amountPaid)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[var(--text-muted)]">Amount Due</span>
              <span className={`font-medium ${order.amountDue > 0 ? "text-yellow-400" : "text-[var(--text-muted)]"}`}>
                {formatCurrency(order.amountDue)}
              </span>
            </div>
            <div className="flex justify-between text-sm pt-1 border-t border-white/5">
              <span className="text-[var(--text-muted)]">Payment Status</span>
              <span className={`font-bold text-xs uppercase ${paymentColors[order.paymentStatus] ?? ""}`}>
                {order.paymentStatus}
              </span>
            </div>
          </div>

          {/* Dealer */}
          <div className="glass border border-[var(--border-color)] rounded-xl p-4">
            <h2 className="font-semibold text-[var(--text-primary)] text-sm mb-3">Dealer</h2>
            <p className="text-[var(--text-primary)] text-sm font-medium">{(order.dealer as any).companyName}</p>
            <p className="text-[var(--text-muted)] text-xs mt-0.5">{(order.dealer as any).user?.email}</p>
            {(order.dealer as any).phone && (
              <p className="text-[var(--text-muted)] text-xs mt-0.5">{(order.dealer as any).phone}</p>
            )}
          </div>

          {/* Delivery address */}
          {order.shippingAddress && (
            <div className="glass border border-[var(--border-color)] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="w-4 h-4 text-[var(--text-muted)]" />
                <h2 className="font-semibold text-[var(--text-primary)] text-sm">Delivery</h2>
              </div>
              {order.deliveryName && <p className="text-[var(--text-primary)] text-sm font-medium">{order.deliveryName}</p>}
              {order.deliveryPhone && <p className="text-[var(--text-muted)] text-xs mt-0.5">{order.deliveryPhone}</p>}
              <p className="text-[var(--text-muted)] text-xs mt-1 leading-relaxed">{order.shippingAddress}</p>
              {(order.deliveryCity || order.deliveryPincode) && (
                <p className="text-[var(--text-muted)] text-xs mt-0.5">
                  {[order.deliveryCity, order.deliveryState, order.deliveryPincode].filter(Boolean).join(", ")}
                </p>
              )}
            </div>
          )}

          {/* Shipment */}
          {order.shipment && (
            <div className="glass border border-[var(--border-color)] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Truck className="w-4 h-4 text-[var(--text-muted)]" />
                <h2 className="font-semibold text-[var(--text-primary)] text-sm">Shipment</h2>
              </div>
              <p className="text-[var(--text-primary)] text-sm font-mono">{order.shipment.waybill}</p>
              <p className="text-[var(--text-muted)] text-xs mt-1 uppercase tracking-wider">{order.shipment.status}</p>
              {order.shipment.trackingUrl && (
                <a
                  href={order.shipment.trackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-red-400 hover:text-red-300 text-xs mt-2 inline-block"
                >
                  Track shipment →
                </a>
              )}
            </div>
          )}

          {/* Invoice */}
          {order.invoice && (
            <div className="glass border border-[var(--border-color)] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="w-4 h-4 text-[var(--text-muted)]" />
                <h2 className="font-semibold text-[var(--text-primary)] text-sm">Invoice</h2>
              </div>
              <p className="text-[var(--text-primary)] text-sm font-mono">{order.invoice.invoiceNumber}</p>
              <p className="text-[var(--text-muted)] text-xs mt-0.5">{formatDate(order.invoice.issuedAt)}</p>
              {order.invoice.pdfUrl && (
                <a
                  href={order.invoice.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-red-400 hover:text-red-300 text-xs mt-2 inline-block"
                >
                  Download PDF →
                </a>
              )}
            </div>
          )}

          {/* Notes */}
          {order.notes && (
            <div className="glass border border-[var(--border-color)] rounded-xl p-4">
              <h2 className="font-semibold text-[var(--text-primary)] text-sm mb-2">Notes</h2>
              <p className="text-[var(--text-muted)] text-sm leading-relaxed">{order.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
