import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { formatDate, formatCurrency } from "@/lib/utils";
import { VendorPOActions } from "@/components/vendor/vendor-po-actions";
import { ClipboardList } from "lucide-react";


const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-900/20 text-gray-400",
  SENT: "bg-blue-900/20 text-blue-400",
  ACCEPTED: "bg-green-900/20 text-green-400",
  REJECTED: "bg-red-900/20 text-red-400",
  PARTIALLY_RECEIVED: "bg-yellow-900/20 text-yellow-400",
  FULLY_RECEIVED: "bg-emerald-900/20 text-emerald-400",
  CANCELLED: "bg-gray-900/20 text-gray-500",
  CLOSED: "bg-purple-900/20 text-purple-400",
};

export default async function VendorPurchaseOrdersPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "VENDOR") redirect("/login");

  const vendor = await prisma.vendor.findUnique({
    where: { userId: session.user.id },
  });
  if (!vendor) redirect("/login");

  const pos = await prisma.purchaseOrder.findMany({
    where: { vendorId: vendor.id },
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });

  const pending = pos.filter((p) => p.status === "SENT").length;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight">Purchase Orders</h1>
        <p className="text-[var(--text-muted)] mt-1">
          {pos.length} total · {pending > 0 && <span className="text-blue-400 font-semibold">{pending} awaiting your response</span>}
        </p>
      </div>

      {pos.length === 0 ? (
        <div className="glass border border-[var(--border-color)] rounded-sm p-16 text-center">
          <ClipboardList size={40} className="text-gray-700 mx-auto mb-4" />
          <p className="text-[var(--text-muted)] font-semibold">No purchase orders yet</p>
          <p className="text-gray-700 text-sm mt-1">Orders from MOTOXPLUS will appear here</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pos.map((po) => (
            <div
              key={po.id}
              className={`glass rounded-sm p-5 transition-all ${po.status === "SENT" ? "border border-blue-900/40" : "border border-[var(--border-color)]"}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap mb-2">
                    <span className="text-[var(--text-primary)] font-black font-mono">{po.poNumber}</span>
                    <span className={`text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded-sm ${STATUS_COLORS[po.status]}`}>
                      {po.status.replace("_", " ")}
                    </span>
                    {po.urgency !== "NORMAL" && (
                      <span className={`text-xs font-semibold uppercase tracking-wider ${po.urgency === "CRITICAL" ? "text-red-400" : po.urgency === "HIGH" ? "text-yellow-400" : "text-gray-500"}`}>
                        {po.urgency}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
                    <div>
                      <div className="text-[var(--text-muted)] text-[10px] uppercase tracking-wider mb-0.5">Value</div>
                      <div className="text-[var(--text-primary)] font-bold text-sm">{formatCurrency(po.grandTotal)}</div>
                    </div>
                    <div>
                      <div className="text-[var(--text-muted)] text-[10px] uppercase tracking-wider mb-0.5">Items</div>
                      <div className="text-[var(--text-primary)] font-bold text-sm">{po.items.length}</div>
                    </div>
                    <div>
                      <div className="text-[var(--text-muted)] text-[10px] uppercase tracking-wider mb-0.5">Deliver By</div>
                      <div className="text-[var(--text-primary)] font-bold text-sm">{formatDate(po.deliveryDate)}</div>
                    </div>
                    <div>
                      <div className="text-[var(--text-muted)] text-[10px] uppercase tracking-wider mb-0.5">Received</div>
                      <div className="text-[var(--text-primary)] font-bold text-sm">{formatDate(po.createdAt)}</div>
                    </div>
                  </div>

                  {po.status === "SENT" && (
                    <div className="mt-4 p-3 bg-blue-900/10 border border-blue-900/30 rounded-sm">
                      <p className="text-blue-300 text-xs">
                        Action required — please accept or reject this purchase order
                      </p>
                    </div>
                  )}

                  {po.vendorNotes && po.status === "REJECTED" && (
                    <div className="mt-3 text-[var(--text-muted)] text-xs">
                      Your note: {po.vendorNotes}
                    </div>
                  )}

                  {po.termsAndConditions && (
                    <details className="mt-3">
                      <summary className="text-[var(--text-muted)] text-xs cursor-pointer hover:text-[var(--text-primary)] transition-colors">
                        View Terms & Conditions
                      </summary>
                      <p className="text-[var(--text-muted)] text-xs mt-2 pl-2 border-l border-[var(--border-color)]">
                        {po.termsAndConditions}
                      </p>
                    </details>
                  )}
                </div>

                <div className="flex-shrink-0">
                  {po.status === "SENT" && <VendorPOActions poId={po.id} />}
                </div>
              </div>

              {/* Line items collapsible */}
              <details className="mt-4">
                <summary className="text-[var(--text-muted)] text-xs cursor-pointer hover:text-[var(--text-primary)] transition-colors uppercase tracking-wider">
                  View {po.items.length} item{po.items.length !== 1 ? "s" : ""}
                </summary>
                <div className="mt-3 space-y-1">
                  {po.items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between py-1.5 text-sm border-b border-white/5 last:border-0">
                      <span className="text-[var(--text-secondary)]">{item.description}</span>
                      <div className="flex items-center gap-4 text-xs text-right">
                        <span className="text-[var(--text-muted)]">{item.quantity} {item.unit}</span>
                        <span className="text-[var(--text-primary)] font-bold">{formatCurrency(item.total)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
