import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import Link from "next/link";
import { Plus, AlertTriangle, ArrowRight } from "lucide-react";
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

const ALL_STATUSES = ["SUBMITTED", "APPROVED", "REJECTED", "CONVERTED"];

export default async function PurchaseRequestsPage({
  searchParams,
}: {
  searchParams: { status?: string; page?: string };
}) {
  const page = parseInt(searchParams.page || "1");
  const pageSize = 20;
  const where: any = {};
  if (searchParams.status) where.status = searchParams.status;

  const [requests, total, pendingCount] = await Promise.all([
    prisma.purchaseRequest.findMany({
      where,
      include: {
        items: true,
        purchaseOrder: { select: { id: true, poNumber: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.purchaseRequest.count({ where }),
    prisma.purchaseRequest.count({ where: { status: "SUBMITTED" } }),
  ]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight">
            Purchase Requests
          </h1>
          <p className="text-[var(--text-muted)] mt-1">
            {total} total · {pendingCount} awaiting approval
          </p>
        </div>
        <Link
          href="/admin/procurement/requests/new"
          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-2.5 rounded-sm text-sm transition-colors uppercase tracking-wider"
        >
          <Plus size={16} />
          New Request
        </Link>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <Link
          href="/admin/procurement/requests"
          className={`px-3 py-2 rounded-sm text-xs font-semibold uppercase tracking-wider transition-colors ${!searchParams.status ? "bg-red-600 text-white" : "glass border border-[var(--border-color)] text-[var(--text-muted)] hover:border-red-600/50"}`}
        >
          All
        </Link>
        {ALL_STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/procurement/requests?status=${s}`}
            className={`px-3 py-2 rounded-sm text-xs font-semibold uppercase tracking-wider transition-colors ${searchParams.status === s ? "bg-red-600 text-white" : "glass border border-[var(--border-color)] text-[var(--text-muted)] hover:border-red-600/50"}`}
          >
            {s}
          </Link>
        ))}
      </div>

      <div className="space-y-3">
        {requests.length === 0 ? (
          <div className="glass border border-[var(--border-color)] rounded-sm p-16 text-center">
            <p className="text-[var(--text-muted)]">No purchase requests found</p>
          </div>
        ) : (
          requests.map((req) => (
            <div
              key={req.id}
              className="glass border border-[var(--border-color)] hover:border-red-900/30 rounded-sm p-5 transition-all"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap mb-2">
                    <span className="text-[var(--text-muted)] text-xs font-mono">{req.requestNumber}</span>
                    <span className={`text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded-sm ${STATUS_COLORS[req.status]}`}>
                      {req.status}
                    </span>
                    <span className={`text-xs font-semibold uppercase tracking-wider ${URGENCY_COLORS[req.urgency]}`}>
                      {req.urgency === "CRITICAL" && <AlertTriangle size={12} className="inline mr-1" />}
                      {req.urgency}
                    </span>
                  </div>
                  <div className="text-[var(--text-primary)] font-bold mb-1">{req.title}</div>
                  <div className="text-[var(--text-muted)] text-xs">
                    {req.items.length} item{req.items.length !== 1 ? "s" : ""} · By {req.requestedByName} · {formatDate(req.createdAt)}
                  </div>
                  {req.purchaseOrder && (
                    <Link
                      href={`/admin/procurement/purchase-orders/${req.purchaseOrder.id}`}
                      className="inline-flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 mt-2"
                    >
                      PO: {req.purchaseOrder.poNumber} <ArrowRight size={10} />
                    </Link>
                  )}
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {req.status === "SUBMITTED" && <PRActions requestId={req.id} />}
                  <Link
                    href={`/admin/procurement/requests/${req.id}`}
                    className="text-xs font-semibold text-[var(--text-muted)] hover:text-red-400 uppercase tracking-wider transition-colors"
                  >
                    View
                  </Link>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`/admin/procurement/requests?page=${p}${searchParams.status ? `&status=${searchParams.status}` : ""}`}
              className={`w-10 h-10 flex items-center justify-center rounded-sm text-sm font-bold ${p === page ? "bg-red-600 text-white" : "glass border border-[var(--border-color)] text-[var(--text-muted)]"}`}
            >
              {p}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
