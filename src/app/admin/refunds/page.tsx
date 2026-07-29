import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { formatCurrency, formatDate } from "@/lib/utils";
import Link from "next/link";
import type { RefundStatus } from "@prisma/client";
import { RetryRefundAction } from "@/components/admin/retry-refund-action";

const ALLOWED = ["ADMIN", "SUPER_ADMIN", "ACCOUNTS"];

function statusBadge(status: RefundStatus) {
  const map: Record<RefundStatus, string> = {
    INITIATED: "bg-yellow-900/20 text-yellow-400 border-yellow-400/20",
    PROCESSED: "bg-green-900/20 text-green-400 border-green-400/20",
    FAILED: "bg-red-900/20 text-red-400 border-red-400/20",
    NOT_APPLICABLE: "bg-zinc-900/20 text-zinc-400 border-zinc-400/20",
  };
  return `inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border ${map[status]}`;
}

export default async function AdminRefundsPage(props: { searchParams: Promise<{ status?: string }> }) {
  const searchParams = await props.searchParams;
  const session = await getServerSession(authOptions);
  if (!session || !ALLOWED.includes(session.user.role)) redirect("/login");

  // Refund ops only cares about cancellations that actually needed money back
  // — NOT_APPLICABLE (waived / nothing paid) never appears in this list.
  const filterStatus = (["INITIATED", "PROCESSED", "FAILED"] as const).includes(searchParams.status as any)
    ? (searchParams.status as "INITIATED" | "PROCESSED" | "FAILED")
    : undefined;

  const [cancellations, counts] = await Promise.all([
    prisma.orderCancellation.findMany({
      where: { refundStatus: filterStatus ?? { in: ["INITIATED", "PROCESSED", "FAILED"] } },
      include: { order: { select: { orderNumber: true, dealer: { select: { companyName: true } } } } },
      orderBy: { cancelledAt: "desc" },
      take: 100,
    }),
    Promise.all([
      prisma.orderCancellation.count({ where: { refundStatus: "INITIATED" } }),
      prisma.orderCancellation.count({ where: { refundStatus: "PROCESSED" } }),
      prisma.orderCancellation.count({ where: { refundStatus: "FAILED" } }),
    ]).then(([initiated, processed, failed]) => ({ initiated, processed, failed })),
  ]);

  const tabs = [
    { key: "", label: "All", count: counts.initiated + counts.processed + counts.failed },
    { key: "INITIATED", label: "Pending", count: counts.initiated },
    { key: "FAILED", label: "Failed", count: counts.failed },
    { key: "PROCESSED", label: "Completed", count: counts.processed },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight">Refunds</h1>
        <p className="text-[var(--text-muted)] text-sm mt-1">Cancellation refunds, by Razorpay status</p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Pending", value: counts.initiated, color: "text-yellow-400" },
          { label: "Failed", value: counts.failed, color: "text-red-400" },
          { label: "Completed", value: counts.processed, color: "text-green-400" },
        ].map((s) => (
          <div key={s.label} className="glass border border-[var(--border-color)] rounded-xl p-4 text-center">
            <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
            <div className="text-[var(--text-muted)] text-xs mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mb-5 flex-wrap">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={`/admin/refunds${tab.key ? `?status=${tab.key}` : ""}`}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors ${
              (filterStatus ?? "") === tab.key
                ? "bg-red-600 text-white"
                : "glass border border-[var(--border-color)] text-[var(--text-muted)] hover:border-red-600/50"
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={`ml-1.5 px-1.5 py-0.5 rounded text-[10px] ${(filterStatus ?? "") === tab.key ? "bg-red-700" : "bg-[var(--bg-card)]"}`}>
                {tab.count}
              </span>
            )}
          </Link>
        ))}
      </div>

      {cancellations.length === 0 ? (
        <div className="glass border border-[var(--border-color)] rounded-xl p-16 text-center text-[var(--text-muted)]">
          No refunds in this status.
        </div>
      ) : (
        <div className="glass border border-[var(--border-color)] rounded-xl overflow-hidden">
          <div className="divide-y divide-white/5">
            {cancellations.map((c) => (
              <div key={c.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1.5 flex-wrap">
                    <Link href={`/admin/orders/${c.orderId}`} className="text-[var(--text-primary)] font-black text-sm font-mono hover:text-red-400">
                      #{c.order.orderNumber}
                    </Link>
                    <span className={statusBadge(c.refundStatus)}>{c.refundStatus}</span>
                  </div>
                  <p className="text-[var(--text-muted)] text-xs">{c.order.dealer.companyName} · {formatDate(c.cancelledAt)}</p>
                  {c.refundError && <p className="text-red-400 text-xs mt-1">{c.refundError}</p>}
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-[var(--text-primary)] font-mono font-bold text-sm">{formatCurrency(c.refundAmount)}</div>
                  {c.refundId && <div className="text-[var(--text-muted)] text-[10px] font-mono mt-0.5">{c.refundId}</div>}
                </div>
                {c.refundStatus === "FAILED" && (
                  <div className="flex-shrink-0">
                    <RetryRefundAction cancellationId={c.id} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
