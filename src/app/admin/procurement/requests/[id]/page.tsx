import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import { ArrowLeft, ArrowRight, Package } from "lucide-react";
import { PRActions } from "@/components/admin/pr-actions";

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-900/20 text-gray-400",
  SUBMITTED: "bg-blue-900/20 text-blue-400",
  APPROVED: "bg-green-900/20 text-green-400",
  REJECTED: "bg-red-900/20 text-red-400",
  CONVERTED: "bg-purple-900/20 text-purple-400",
};

const URGENCY_COLORS: Record<string, string> = {
  LOW: "text-gray-500",
  NORMAL: "text-blue-400",
  HIGH: "text-yellow-400",
  CRITICAL: "text-red-400",
};

export default async function PurchaseRequestDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const request = await prisma.purchaseRequest.findUnique({
    where: { id: params.id },
    include: {
      items: true,
      purchaseOrder: {
        include: { vendor: true, items: true },
      },
    },
  });

  if (!request) notFound();

  return (
    <div className="max-w-4xl">
      <div className="mb-8 flex items-start gap-4">
        <Link href="/admin/procurement/requests" className="glass border border-[var(--border-color)] p-2 rounded-sm hover:border-red-900/40 transition-colors mt-1">
          <ArrowLeft size={18} className="text-[var(--text-muted)]" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-black text-[var(--text-primary)] tracking-tight">{request.title}</h1>
            <span className={`text-xs font-semibold uppercase tracking-wider px-2 py-1 rounded-sm ${STATUS_COLORS[request.status]}`}>
              {request.status}
            </span>
            <span className={`text-xs font-semibold uppercase tracking-wider ${URGENCY_COLORS[request.urgency]}`}>
              {request.urgency}
            </span>
          </div>
          <p className="text-[var(--text-muted)] mt-1 text-sm">
            {request.requestNumber} · By {request.requestedByName} · {formatDate(request.createdAt)}
          </p>
        </div>
        {request.status === "SUBMITTED" && <PRActions requestId={request.id} />}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Items */}
          <div className="glass border border-[var(--border-color)] rounded-sm p-6">
            <h2 className="text-[var(--text-primary)] font-bold text-sm uppercase tracking-widest mb-5">
              Requested Items
            </h2>
            <div className="space-y-3">
              {request.items.map((item, i) => (
                <div key={item.id} className="p-4 glass border border-[var(--border-color)] rounded-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-[var(--text-primary)] font-bold text-sm">{item.description}</div>
                      <div className="text-[var(--text-muted)] text-xs mt-1">
                        {item.quantity} {item.unit}
                        {item.estimatedUnitPrice && ` · Est. ₹${item.estimatedUnitPrice}/unit`}
                      </div>
                      {item.notes && <div className="text-gray-600 text-xs mt-1">{item.notes}</div>}
                    </div>
                    <span className="text-[var(--text-muted)] text-xs">#{i + 1}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Linked PO */}
          {request.purchaseOrder && (
            <div className="glass border border-[var(--border-color)] rounded-sm p-6">
              <h2 className="text-[var(--text-primary)] font-bold text-sm uppercase tracking-widest mb-4">
                Purchase Order Created
              </h2>
              <Link
                href={`/admin/procurement/purchase-orders/${request.purchaseOrder.id}`}
                className="flex items-center justify-between p-4 glass border border-purple-900/30 hover:border-purple-600/50 rounded-sm transition-all group"
              >
                <div>
                  <div className="text-[var(--text-primary)] font-bold">{request.purchaseOrder.poNumber}</div>
                  <div className="text-[var(--text-muted)] text-xs mt-0.5">
                    {request.purchaseOrder.vendor.companyName}
                  </div>
                </div>
                <ArrowRight size={16} className="text-purple-400 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          )}

          {request.notes && (
            <div className="glass border border-[var(--border-color)] rounded-sm p-6">
              <h2 className="text-[var(--text-primary)] font-bold text-sm uppercase tracking-widest mb-3">Notes</h2>
              <p className="text-[var(--text-secondary)] text-sm whitespace-pre-wrap">{request.notes}</p>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="glass border border-[var(--border-color)] rounded-sm p-6">
            <h2 className="text-[var(--text-primary)] font-bold text-sm uppercase tracking-widest mb-4">Details</h2>
            <div className="space-y-3">
              {[
                { label: "Request No.", value: request.requestNumber },
                { label: "Department", value: request.departmentCode },
                { label: "Urgency", value: request.urgency },
                { label: "Requested By", value: request.requestedByName },
                { label: "Submitted", value: formatDate(request.createdAt) },
                ...(request.approvedAt
                  ? [{ label: "Actioned On", value: formatDate(request.approvedAt) }]
                  : []),
                ...(request.rejectionReason
                  ? [{ label: "Rejection Reason", value: request.rejectionReason }]
                  : []),
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between gap-2">
                  <span className="text-[var(--text-muted)] text-xs">{label}</span>
                  <span className="text-[var(--text-primary)] text-xs font-semibold text-right">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {request.status === "APPROVED" && !request.purchaseOrder && (
            <Link
              href={`/admin/procurement/purchase-orders/new?prId=${request.id}`}
              className="flex items-center justify-center gap-2 w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-sm text-sm uppercase tracking-wider transition-colors"
            >
              <Package size={16} />
              Create Purchase Order
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
