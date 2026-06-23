import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { formatDate, formatCurrency } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";
import { GRNForm } from "@/components/admin/grn-form";

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-900/20 text-gray-400 border-gray-900/30",
  SENT: "bg-blue-900/20 text-blue-400 border-blue-900/30",
  ACCEPTED: "bg-green-900/20 text-green-400 border-green-900/30",
  REJECTED: "bg-red-900/20 text-red-400 border-red-900/30",
  PARTIALLY_RECEIVED: "bg-yellow-900/20 text-yellow-400 border-yellow-900/30",
  FULLY_RECEIVED: "bg-emerald-900/20 text-emerald-400 border-emerald-900/30",
  CANCELLED: "bg-gray-900/20 text-gray-500 border-gray-900/30",
  CLOSED: "bg-purple-900/20 text-purple-400 border-purple-900/30",
};

export default async function PurchaseOrderDetailPage({ params }: { params: { id: string } }) {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: params.id },
    include: {
      vendor: { include: { contacts: { where: { isPrimary: true }, take: 1 } } },
      items: true,
      purchaseRequest: { select: { id: true, requestNumber: true, title: true } },
      goodsReceivedNotes: { include: { items: true }, orderBy: { createdAt: "desc" } },
      vendorPayments: { orderBy: { paymentDate: "desc" } },
    },
  });

  if (!po) notFound();

  const totalReceived = po.goodsReceivedNotes.reduce(
    (s, grn) => s + grn.items.reduce((ss, i) => ss + i.acceptedQuantity, 0),
    0
  );
  const totalOrdered = po.items.reduce((s, i) => s + i.quantity, 0);

  const canCreateGRN = ["SENT", "ACCEPTED", "PARTIALLY_RECEIVED"].includes(po.status);

  return (
    <div className="max-w-5xl">
      <div className="mb-8 flex items-start gap-4">
        <Link href="/admin/procurement/purchase-orders" className="glass border border-[var(--border-color)] p-2 rounded-sm hover:border-red-900/40 transition-colors mt-1">
          <ArrowLeft size={18} className="text-[var(--text-muted)]" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-black text-[var(--text-primary)] font-mono tracking-tight">{po.poNumber}</h1>
            <span className={`text-xs font-semibold uppercase tracking-wider px-2.5 py-1 rounded-sm border ${STATUS_COLORS[po.status]}`}>
              {po.status.replace("_", " ")}
            </span>
          </div>
          <p className="text-[var(--text-muted)] mt-1 text-sm">
            {po.vendor.companyName} · Created {formatDate(po.createdAt)}
          </p>
        </div>
        {canCreateGRN && <GRNForm purchaseOrderId={po.id} poItems={po.items} />}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Line Items */}
          <div className="glass border border-[var(--border-color)] rounded-sm p-6">
            <h2 className="text-[var(--text-primary)] font-bold text-sm uppercase tracking-widest mb-5">Order Items</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-color)]">
                    <th className="pb-3 text-left text-xs text-[var(--text-muted)] uppercase tracking-wider">Description</th>
                    <th className="pb-3 text-right text-xs text-[var(--text-muted)] uppercase tracking-wider">Qty</th>
                    <th className="pb-3 text-right text-xs text-[var(--text-muted)] uppercase tracking-wider hidden md:table-cell">Price</th>
                    <th className="pb-3 text-right text-xs text-[var(--text-muted)] uppercase tracking-wider hidden md:table-cell">GST</th>
                    <th className="pb-3 text-right text-xs text-[var(--text-muted)] uppercase tracking-wider">Total</th>
                    <th className="pb-3 text-right text-xs text-[var(--text-muted)] uppercase tracking-wider">Received</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {po.items.map((item) => (
                    <tr key={item.id}>
                      <td className="py-3 text-[var(--text-primary)]">{item.description}</td>
                      <td className="py-3 text-right text-[var(--text-muted)]">{item.quantity} {item.unit}</td>
                      <td className="py-3 text-right text-[var(--text-muted)] hidden md:table-cell">{formatCurrency(item.unitPrice)}</td>
                      <td className="py-3 text-right text-[var(--text-muted)] hidden md:table-cell">{item.gstRate}%</td>
                      <td className="py-3 text-right text-[var(--text-primary)] font-bold">{formatCurrency(item.total)}</td>
                      <td className="py-3 text-right">
                        <span className={`text-xs font-semibold ${item.receivedQty >= item.quantity ? "text-green-400" : item.receivedQty > 0 ? "text-yellow-400" : "text-gray-600"}`}>
                          {item.receivedQty}/{item.quantity}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-[var(--border-color)]">
                    <td colSpan={4} className="pt-4 text-right text-[var(--text-muted)] text-xs uppercase tracking-wider">Grand Total</td>
                    <td className="pt-4 text-right text-[var(--text-primary)] font-black text-lg" colSpan={2}>{formatCurrency(po.grandTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {po.termsAndConditions && (
              <div className="mt-5 pt-5 border-t border-[var(--border-color)]">
                <div className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-2">Terms & Conditions</div>
                <p className="text-[var(--text-muted)] text-sm">{po.termsAndConditions}</p>
              </div>
            )}
          </div>

          {/* GRNs */}
          {po.goodsReceivedNotes.length > 0 && (
            <div className="glass border border-[var(--border-color)] rounded-sm p-6">
              <h2 className="text-[var(--text-primary)] font-bold text-sm uppercase tracking-widest mb-4">
                Goods Received Notes
              </h2>
              <div className="space-y-3">
                {po.goodsReceivedNotes.map((grn) => (
                  <div key={grn.id} className="p-4 glass border border-[var(--border-color)] rounded-sm">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[var(--text-primary)] font-bold font-mono text-sm">{grn.grnNumber}</span>
                      <div className="flex items-center gap-3">
                        <span className={`text-xs font-semibold uppercase px-2 py-0.5 rounded-sm ${grn.qualityStatus === "ACCEPTED" ? "bg-green-900/20 text-green-400" : grn.qualityStatus === "REJECTED" ? "bg-red-900/20 text-red-400" : "bg-yellow-900/20 text-yellow-400"}`}>
                          {grn.qualityStatus}
                        </span>
                        <span className="text-[var(--text-muted)] text-xs">{formatDate(grn.receivedAt)}</span>
                      </div>
                    </div>
                    <div className="text-[var(--text-muted)] text-xs">
                      By {grn.receivedByName} · {grn.items.length} item{grn.items.length !== 1 ? "s" : ""}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Vendor Notes */}
          {po.vendorNotes && (
            <div className="glass border border-yellow-900/20 rounded-sm p-5">
              <div className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-2">Vendor Notes</div>
              <p className="text-[var(--text-secondary)] text-sm">{po.vendorNotes}</p>
            </div>
          )}
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          <div className="glass border border-[var(--border-color)] rounded-sm p-6">
            <h2 className="text-[var(--text-primary)] font-bold text-sm uppercase tracking-widest mb-4">Vendor</h2>
            <Link href={`/admin/vendors/${po.vendor.id}`}>
              <div className="text-[var(--text-primary)] font-bold hover:text-red-400 transition-colors">{po.vendor.companyName}</div>
            </Link>
            <div className="text-[var(--text-muted)] text-xs font-mono mt-1">{po.vendor.vendorCode}</div>
            {po.vendor.contacts[0] && (
              <div className="mt-3 pt-3 border-t border-[var(--border-color)] text-[var(--text-muted)] text-xs">
                {po.vendor.contacts[0].name} · {po.vendor.contacts[0].phone}
              </div>
            )}
          </div>

          <div className="glass border border-[var(--border-color)] rounded-sm p-6">
            <h2 className="text-[var(--text-primary)] font-bold text-sm uppercase tracking-widest mb-4">Timeline</h2>
            <div className="space-y-3">
              {[
                { label: "Created", date: po.createdAt },
                ...(po.acceptedAt ? [{ label: "Accepted", date: po.acceptedAt }] : []),
                ...(po.rejectedAt ? [{ label: "Rejected", date: po.rejectedAt }] : []),
                ...(po.closedAt ? [{ label: "Closed", date: po.closedAt }] : []),
              ].map(({ label, date }) => (
                <div key={label} className="flex justify-between">
                  <span className="text-[var(--text-muted)] text-xs">{label}</span>
                  <span className="text-[var(--text-primary)] text-xs">{formatDate(date)}</span>
                </div>
              ))}
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)] text-xs">Delivery By</span>
                <span className="text-[var(--text-primary)] text-xs font-bold">{formatDate(po.deliveryDate)}</span>
              </div>
            </div>
          </div>

          <div className="glass border border-[var(--border-color)] rounded-sm p-6">
            <h2 className="text-[var(--text-primary)] font-bold text-sm uppercase tracking-widest mb-4">Receipt Progress</h2>
            <div className="mb-3">
              <div className="flex justify-between text-xs mb-2">
                <span className="text-[var(--text-muted)]">Items Received</span>
                <span className="text-[var(--text-primary)] font-bold">{totalReceived} / {totalOrdered}</span>
              </div>
              <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all"
                  style={{ width: `${totalOrdered > 0 ? (totalReceived / totalOrdered) * 100 : 0}%` }}
                />
              </div>
            </div>
            <div className="text-[var(--text-muted)] text-xs">
              {po.goodsReceivedNotes.length} GRN{po.goodsReceivedNotes.length !== 1 ? "s" : ""} created
            </div>
          </div>

          {po.purchaseRequest && (
            <Link
              href={`/admin/procurement/requests/${po.purchaseRequest.id}`}
              className="flex items-center justify-between p-4 glass border border-[var(--border-color)] hover:border-red-900/30 rounded-sm transition-all group"
            >
              <div>
                <div className="text-[var(--text-muted)] text-[10px] uppercase tracking-wider mb-1">Source PR</div>
                <div className="text-[var(--text-primary)] text-sm font-mono">{po.purchaseRequest.requestNumber}</div>
                <div className="text-[var(--text-muted)] text-xs truncate">{po.purchaseRequest.title}</div>
              </div>
              <ArrowLeft size={14} className="text-[var(--text-muted)] rotate-180 group-hover:text-red-400" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
