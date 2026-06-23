import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";
import { PaymentActions } from "./payment-actions";

const ALLOWED = ["ADMIN", "SUPER_ADMIN", "STAFF"];

function statusBadge(status: string) {
  const map: Record<string, string> = {
    SUBMITTED:    "bg-blue-900/20 text-blue-400 border-blue-400/20",
    UNDER_REVIEW: "bg-yellow-900/20 text-yellow-400 border-yellow-400/20",
    VERIFIED:     "bg-green-900/20 text-green-400 border-green-400/20",
    REJECTED:     "bg-red-900/20 text-red-400 border-red-400/20",
  };
  return `inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border ${map[status] ?? "bg-zinc-900/20 text-zinc-400 border-zinc-400/20"}`;
}

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: { status?: string; page?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session || !ALLOWED.includes(session.user.role)) redirect("/login");

  const filterStatus = searchParams.status || "";
  const page = parseInt(searchParams.page || "1");
  const pageSize = 20;

  const where = filterStatus ? { status: filterStatus as any } : {};

  const [submissions, total, counts] = await Promise.all([
    prisma.paymentSubmission.findMany({
      where,
      include: {
        order: { select: { orderNumber: true, grandTotal: true, amountDue: true, status: true, createdAt: true } },
        dealer: { select: { companyName: true, ownerName: true, phone: true, city: true, state: true } },
      },
      orderBy: { submittedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.paymentSubmission.count({ where }),
    Promise.all([
      prisma.paymentSubmission.count({ where: { status: "SUBMITTED" } }),
      prisma.paymentSubmission.count({ where: { status: "UNDER_REVIEW" } }),
      prisma.paymentSubmission.count({ where: { status: "VERIFIED" } }),
      prisma.paymentSubmission.count({ where: { status: "REJECTED" } }),
    ]).then(([submitted, underReview, verified, rejected]) => ({ submitted, underReview, verified, rejected })),
  ]);

  const totalPages = Math.ceil(total / pageSize);

  const tabs = [
    { key: "", label: "All", count: counts.submitted + counts.underReview + counts.verified + counts.rejected },
    { key: "SUBMITTED", label: "New", count: counts.submitted },
    { key: "UNDER_REVIEW", label: "Under Review", count: counts.underReview },
    { key: "VERIFIED", label: "Verified", count: counts.verified },
    { key: "REJECTED", label: "Rejected", count: counts.rejected },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight">Payment Submissions</h1>
        <p className="text-[var(--text-muted)] text-sm mt-1">Verify UPI and bank transfer payments from dealers</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Awaiting Review", value: counts.submitted, color: "text-blue-400" },
          { label: "Under Review", value: counts.underReview, color: "text-yellow-400" },
          { label: "Verified", value: counts.verified, color: "text-green-400" },
          { label: "Rejected", value: counts.rejected, color: "text-red-400" },
        ].map((s) => (
          <div key={s.label} className="glass border border-[var(--border-color)] rounded-xl p-4 text-center">
            <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
            <div className="text-[var(--text-muted)] text-xs mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={`/admin/payments${tab.key ? `?status=${tab.key}` : ""}`}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors ${
              filterStatus === tab.key
                ? "bg-red-600 text-white"
                : "glass border border-[var(--border-color)] text-[var(--text-muted)] hover:border-red-600/50"
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={`ml-1.5 px-1.5 py-0.5 rounded text-[10px] ${filterStatus === tab.key ? "bg-red-700" : "bg-[var(--bg-card)]"}`}>
                {tab.count}
              </span>
            )}
          </Link>
        ))}
      </div>

      {submissions.length === 0 ? (
        <div className="glass border border-[var(--border-color)] rounded-xl p-16 text-center text-[var(--text-muted)]">
          No payment submissions found.
        </div>
      ) : (
        <div className="space-y-4">
          {submissions.map((sub) => (
            <div key={sub.id} className="glass border border-[var(--border-color)] rounded-xl overflow-hidden">
              <div className="p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  {/* Left: Order + dealer info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <span className="text-[var(--text-primary)] font-black text-sm">#{sub.order.orderNumber}</span>
                      <span className={statusBadge(sub.status)}>{sub.status.replace("_", " ")}</span>
                      <span className="text-xs bg-zinc-900/40 border border-[var(--border-color)] px-2 py-0.5 rounded text-[var(--text-muted)] font-semibold">
                        {sub.paymentMethod === "UPI" ? "Direct UPI" : "Bank Transfer"}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-2 text-xs mb-3">
                      <div>
                        <div className="text-[var(--text-muted)]">Dealer</div>
                        <div className="text-[var(--text-primary)] font-semibold truncate">{sub.dealer.companyName}</div>
                      </div>
                      <div>
                        <div className="text-[var(--text-muted)]">Amount</div>
                        <div className="text-red-400 font-black">{formatCurrency(sub.amount)}</div>
                      </div>
                      <div>
                        <div className="text-[var(--text-muted)]">UTR / Ref</div>
                        <div className="font-mono text-[var(--text-primary)] font-semibold">{sub.utrNumber}</div>
                      </div>
                      <div>
                        <div className="text-[var(--text-muted)]">Submitted</div>
                        <div className="text-[var(--text-secondary)]">
                          {new Date(sub.submittedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 text-xs">
                      <div>
                        <div className="text-[var(--text-muted)]">Payer Name</div>
                        <div className="text-[var(--text-secondary)]">{sub.payerName}</div>
                      </div>
                      <div>
                        <div className="text-[var(--text-muted)]">Email</div>
                        <div className="text-[var(--text-secondary)] truncate">{sub.payerEmail}</div>
                      </div>
                      <div>
                        <div className="text-[var(--text-muted)]">Phone</div>
                        <div className="text-[var(--text-secondary)]">{sub.payerPhone}</div>
                      </div>
                    </div>

                    {sub.rejectionReason && (
                      <div className="mt-3 flex items-start gap-2 bg-red-900/10 border border-red-900/30 rounded-lg px-3 py-2 text-red-400 text-xs">
                        <span className="font-semibold">Rejection reason:</span> {sub.rejectionReason}
                      </div>
                    )}
                  </div>

                  {/* Right: Screenshot + Actions */}
                  <div className="flex flex-col items-end gap-3">
                    <a
                      href={sub.screenshotUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block flex-shrink-0"
                    >
                      <img
                        src={sub.screenshotUrl}
                        alt="Payment screenshot"
                        className="w-24 h-16 object-cover rounded-lg border border-[var(--border-color)] hover:opacity-80 transition-opacity cursor-zoom-in"
                      />
                    </a>

                    <div className="flex items-center gap-2">
                      <Link
                        href={`/admin/orders/${sub.orderId}`}
                        className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] border border-[var(--border-color)] px-3 py-1.5 rounded-lg font-semibold transition-colors"
                      >
                        View Order
                      </Link>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action bar */}
              {(sub.status === "SUBMITTED" || sub.status === "UNDER_REVIEW") && (
                <div className="border-t border-[var(--border-color)] px-4 sm:px-5 py-3 bg-black/20">
                  <PaymentActions submissionId={sub.id} status={sub.status} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`/admin/payments?${filterStatus ? `status=${filterStatus}&` : ""}page=${p}`}
              className={`w-9 h-9 flex items-center justify-center rounded-lg text-sm font-bold transition-colors ${
                p === page ? "bg-red-600 text-white" : "glass border border-[var(--border-color)] text-[var(--text-muted)] hover:border-red-600/50"
              }`}
            >
              {p}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
