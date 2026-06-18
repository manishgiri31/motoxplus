import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/utils";
import { redirect } from "next/navigation";
import { CreditCard, Star, ClipboardList, TrendingUp } from "lucide-react";

export default async function VendorDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "VENDOR") redirect("/login");

  const vendor = await prisma.vendor.findUnique({
    where: { userId: session.user.id },
    include: {
      payments: { orderBy: { paymentDate: "desc" }, take: 6 },
      ratings: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  if (!vendor) redirect("/login");

  const totalPaid = vendor.payments
    .filter((p) => p.status === "PAID")
    .reduce((s, p) => s + p.amount, 0);

  const pendingPayments = vendor.payments
    .filter((p) => p.status === "PENDING")
    .reduce((s, p) => s + p.amount, 0);

  const latestRating = vendor.ratings[0];

  const STATUS_COLORS: Record<string, string> = {
    PENDING: "bg-yellow-900/20 text-yellow-400",
    APPROVED: "bg-green-900/20 text-green-400",
    REJECTED: "bg-red-900/20 text-red-400",
    SUSPENDED: "bg-orange-900/20 text-orange-400",
    BLACKLISTED: "bg-purple-900/20 text-purple-400",
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight">
          Welcome, {vendor.companyName}
        </h1>
        <div className="flex items-center gap-3 mt-2">
          <span className="text-[var(--text-muted)] text-sm">{vendor.vendorCode}</span>
          <span className={`text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded-sm ${STATUS_COLORS[vendor.status]}`}>
            {vendor.status}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          {
            icon: CreditCard,
            label: "Total Received",
            value: formatCurrency(totalPaid),
            sub: "all time payments",
            color: "text-green-400",
          },
          {
            icon: TrendingUp,
            label: "Pending Payment",
            value: formatCurrency(pendingPayments),
            sub: "awaiting clearance",
            color: "text-yellow-400",
          },
          {
            icon: Star,
            label: "Current Rating",
            value: latestRating ? `${latestRating.overallScore.toFixed(1)} / 5` : "—",
            sub: latestRating ? `Period: ${latestRating.period}` : "Not rated yet",
            color: "text-amber-400",
          },
          {
            icon: ClipboardList,
            label: "Credit Terms",
            value: `${vendor.creditDays} days`,
            sub: "payment period",
            color: "text-blue-400",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="glass border border-[var(--border-color)] rounded-sm p-5"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-sm bg-[var(--bg-card)] flex items-center justify-center">
                <stat.icon size={18} className={stat.color} />
              </div>
            </div>
            <div className="text-xl font-black text-[var(--text-primary)] mb-0.5">{stat.value}</div>
            <div className="text-[var(--text-muted)] text-xs uppercase tracking-widest">{stat.label}</div>
            <div className="text-gray-600 text-xs mt-0.5">{stat.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Payments */}
        <div className="glass border border-[var(--border-color)] rounded-sm p-6">
          <h2 className="text-[var(--text-primary)] font-bold text-lg mb-5">Recent Payments</h2>
          {vendor.payments.length === 0 ? (
            <p className="text-[var(--text-muted)] text-sm text-center py-6">No payments yet</p>
          ) : (
            <div className="space-y-2">
              {vendor.payments.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-3 glass border border-[var(--border-color)] rounded-sm"
                >
                  <div>
                    <div className="text-[var(--text-primary)] font-bold text-sm">
                      {formatCurrency(p.amount)}
                    </div>
                    <div className="text-[var(--text-muted)] text-xs">
                      {p.paymentMode}
                      {p.referenceNumber && ` · ${p.referenceNumber}`}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[var(--text-muted)] text-xs">{formatDate(p.paymentDate)}</div>
                    <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-sm ${
                      p.status === "PAID" ? "bg-green-900/20 text-green-400" : "bg-yellow-900/20 text-yellow-400"
                    }`}>
                      {p.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Performance */}
        <div className="glass border border-[var(--border-color)] rounded-sm p-6">
          <h2 className="text-[var(--text-primary)] font-bold text-lg mb-5">Performance Rating</h2>
          {latestRating ? (
            <div className="space-y-4">
              <div className="text-center py-4">
                <div className="text-6xl font-black text-amber-400 mb-1">
                  {latestRating.overallScore.toFixed(1)}
                </div>
                <div className="text-[var(--text-muted)] text-sm">out of 5.0</div>
                <div className="text-[var(--text-muted)] text-xs mt-1">Period: {latestRating.period}</div>
              </div>
              <div className="space-y-3 pt-4 border-t border-[var(--border-color)]">
                {[
                  { label: "Quality", score: latestRating.qualityScore },
                  { label: "Delivery", score: latestRating.deliveryScore },
                  { label: "Pricing", score: latestRating.priceScore },
                ].map(({ label, score }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-[var(--text-muted)] text-sm">{label}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-400 rounded-full"
                          style={{ width: `${(score / 5) * 100}%` }}
                        />
                      </div>
                      <span className="text-[var(--text-primary)] text-sm font-bold w-6 text-right">
                        {score.toFixed(1)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              {latestRating.notes && (
                <div className="pt-4 border-t border-[var(--border-color)]">
                  <div className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-2">Notes</div>
                  <p className="text-[var(--text-secondary)] text-sm">{latestRating.notes}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <Star size={32} className="text-gray-700 mx-auto mb-3" />
              <p className="text-[var(--text-muted)] text-sm">No performance ratings yet</p>
              <p className="text-gray-700 text-xs mt-1">Ratings will appear here after your first review</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
