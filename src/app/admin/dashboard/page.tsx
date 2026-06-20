import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/utils";
import Link from "next/link";
import {
  Users,
  Package,
  ClipboardList,
  TrendingUp,
  ArrowRight,
  Clock,
  ChevronRight,
} from "lucide-react";

const statusStyle: Record<string, string> = {
  PENDING:   "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20",
  CONFIRMED: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
  DELIVERED: "bg-green-500/10 text-green-400 border border-green-500/20",
  CANCELLED: "bg-red-500/10 text-red-400 border border-red-500/20",
};

export default async function AdminDashboardPage() {
  const session = await getServerSession(authOptions);

  const [
    totalDealers,
    pendingDealers,
    totalOrders,
    pendingOrders,
    totalProducts,
    revenueData,
    recentOrders,
    recentDealers,
  ] = await Promise.all([
    prisma.dealer.count({ where: { status: "APPROVED" } }),
    prisma.dealer.count({ where: { status: "PENDING" } }),
    prisma.order.count(),
    prisma.order.count({ where: { status: "PENDING" } }),
    prisma.product.count({ where: { isActive: true } }),
    prisma.payment.aggregate({ _sum: { amount: true }, where: { status: "PAID" } }),
    prisma.order.findMany({
      take: 8,
      orderBy: { createdAt: "desc" },
      include: { dealer: { include: { user: true } } },
    }),
    prisma.dealer.findMany({
      where: { status: "PENDING" },
      take: 5,
      orderBy: { createdAt: "desc" },
      include: { user: true },
    }),
  ]);

  const stats = [
    {
      icon: Users,
      label: "Active Dealers",
      value: totalDealers,
      sub: `${pendingDealers} pending`,
      href: "/admin/dealers",
      iconColor: "text-blue-400",
      iconBg: "bg-blue-500/10",
      accent: "border-l-blue-500/60",
    },
    {
      icon: ClipboardList,
      label: "Total Orders",
      value: totalOrders,
      sub: `${pendingOrders} pending`,
      href: "/admin/orders",
      iconColor: "text-yellow-400",
      iconBg: "bg-yellow-500/10",
      accent: "border-l-yellow-500/60",
    },
    {
      icon: Package,
      label: "Products",
      value: totalProducts,
      sub: "active listings",
      href: "/admin/products",
      iconColor: "text-purple-400",
      iconBg: "bg-purple-500/10",
      accent: "border-l-purple-500/60",
    },
    {
      icon: TrendingUp,
      label: "Total Revenue",
      value: formatCurrency(revenueData._sum.amount || 0),
      sub: "paid orders",
      href: "/admin/orders",
      iconColor: "text-green-400",
      iconBg: "bg-green-500/10",
      accent: "border-l-green-500/60",
    },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-black text-[var(--text-primary)] tracking-tight">
          Admin Dashboard
        </h1>
        <p className="text-[var(--text-muted)] mt-1 text-sm">Welcome back, {session?.user?.name}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className={`group glass border border-[var(--border-color)] hover:border-red-900/40 rounded-2xl p-5 transition-all card-hover border-l-4 ${stat.accent}`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`w-9 h-9 rounded-xl ${stat.iconBg} flex items-center justify-center`}>
                <stat.icon size={18} className={stat.iconColor} />
              </div>
              <ChevronRight size={14} className="text-[var(--text-muted)] group-hover:text-red-500 transition-colors" />
            </div>
            <div className="text-2xl font-black text-[var(--text-primary)] mb-0.5">{stat.value}</div>
            <div className="text-[var(--text-muted)] text-[10px] uppercase tracking-widest font-semibold">{stat.label}</div>
            <div className="text-[var(--text-muted)] text-xs mt-1 opacity-60">{stat.sub}</div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Recent Orders */}
        <div className="lg:col-span-2 glass border border-[var(--border-color)] rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-[var(--text-primary)] font-bold text-base">Recent Orders</h2>
            <Link href="/admin/orders" className="flex items-center gap-1 text-red-400 text-xs font-semibold hover:text-red-300 uppercase tracking-wider transition-colors">
              View All <ArrowRight size={12} />
            </Link>
          </div>
          <div className="space-y-2">
            {recentOrders.map((order) => (
              <Link
                key={order.id}
                href={`/admin/orders/${order.id}`}
                className="flex items-center justify-between p-3.5 rounded-xl border border-[var(--border-color)] hover:border-red-900/30 hover:bg-[var(--bg-card-hover)] transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-red-900/15 rounded-lg flex items-center justify-center">
                    <ClipboardList size={13} className="text-red-500" />
                  </div>
                  <div>
                    <div className="text-[var(--text-primary)] font-mono text-xs font-bold">{order.orderNumber}</div>
                    <div className="text-[var(--text-muted)] text-[10px] mt-0.5">{(order.dealer as any).companyName}</div>
                  </div>
                </div>
                <div className="text-right flex items-center gap-3">
                  <div className="text-[var(--text-primary)] font-bold text-sm">{formatCurrency(order.grandTotal)}</div>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${statusStyle[order.status] || "bg-gray-900/20 text-[var(--text-muted)]"}`}>
                    {order.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Pending Dealers */}
        <div className="glass border border-[var(--border-color)] rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-[var(--text-primary)] font-bold text-base">Pending Dealers</h2>
            <Link href="/admin/dealers?status=PENDING" className="flex items-center gap-1 text-red-400 text-xs font-semibold hover:text-red-300 uppercase tracking-wider transition-colors">
              View All <ArrowRight size={12} />
            </Link>
          </div>
          {recentDealers.length === 0 ? (
            <div className="text-center py-8 text-[var(--text-muted)] text-sm">No pending applications</div>
          ) : (
            <div className="space-y-2">
              {recentDealers.map((dealer) => (
                <Link
                  key={dealer.id}
                  href={`/admin/dealers/${dealer.id}`}
                  className="flex items-center gap-3 p-3 rounded-xl border border-[var(--border-color)] hover:border-yellow-900/40 hover:bg-[var(--bg-card-hover)] transition-all group"
                >
                  <div className="w-8 h-8 bg-yellow-900/15 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Clock size={13} className="text-yellow-500" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[var(--text-primary)] text-xs font-bold truncate">{dealer.companyName}</div>
                    <div className="text-[var(--text-muted)] text-[10px]">{dealer.city}, {dealer.state}</div>
                    <div className="text-[var(--text-muted)] text-[10px] opacity-60">{formatDate(dealer.createdAt)}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
          {pendingDealers > 0 && (
            <Link
              href="/admin/dealers?status=PENDING"
              className="w-full mt-4 flex items-center justify-center gap-2 border border-yellow-900/30 hover:border-yellow-600/50 hover:bg-yellow-900/10 text-yellow-400 font-bold py-2.5 rounded-xl transition-colors text-xs uppercase tracking-wider"
            >
              Review {pendingDealers} Applications
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
