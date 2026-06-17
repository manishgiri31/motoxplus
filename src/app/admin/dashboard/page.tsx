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
} from "lucide-react";

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

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight">
          Admin Dashboard
        </h1>
        <p className="text-[var(--text-muted)] mt-1">Welcome back, {session?.user?.name}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { icon: Users, label: "Active Dealers", value: totalDealers, sub: `${pendingDealers} pending`, href: "/admin/dealers", color: "text-blue-400" },
          { icon: ClipboardList, label: "Total Orders", value: totalOrders, sub: `${pendingOrders} pending`, href: "/admin/orders", color: "text-yellow-400" },
          { icon: Package, label: "Products", value: totalProducts, sub: "active listings", href: "/admin/products", color: "text-purple-400" },
          { icon: TrendingUp, label: "Total Revenue", value: formatCurrency(revenueData._sum.amount || 0), sub: "paid orders", href: "/admin/orders", color: "text-green-400" },
        ].map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="group glass border border-[var(--border-color)] hover:border-red-900/40 rounded-sm p-6 transition-all card-hover"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-sm bg-[var(--bg-card)] flex items-center justify-center">
                <stat.icon size={20} className={stat.color} />
              </div>
              <ArrowRight size={14} className="text-gray-700 group-hover:text-red-500 transition-colors" />
            </div>
            <div className="text-2xl font-black text-[var(--text-primary)] mb-1">{stat.value}</div>
            <div className="text-[var(--text-muted)] text-xs uppercase tracking-widest">{stat.label}</div>
            <div className="text-gray-600 text-xs mt-1">{stat.sub}</div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Orders */}
        <div className="lg:col-span-2 glass border border-[var(--border-color)] rounded-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[var(--text-primary)] font-bold text-lg">Recent Orders</h2>
            <Link href="/admin/orders" className="text-red-400 text-xs font-semibold hover:text-red-300 uppercase tracking-wider">
              View All →
            </Link>
          </div>
          <div className="space-y-2">
            {recentOrders.map((order) => (
              <Link
                key={order.id}
                href={`/admin/orders/${order.id}`}
                className="flex items-center justify-between p-3 glass border border-[var(--border-color)] hover:border-red-900/30 rounded-sm transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-red-900/20 rounded-sm flex items-center justify-center">
                    <ClipboardList size={14} className="text-red-500" />
                  </div>
                  <div>
                    <div className="text-[var(--text-primary)] font-mono text-xs font-bold">{order.orderNumber}</div>
                    <div className="text-[var(--text-muted)] text-xs">{(order.dealer as any).companyName}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[var(--text-primary)] font-bold text-sm">{formatCurrency(order.grandTotal)}</div>
                  <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-sm ${
                    order.status === "PENDING" ? "bg-yellow-900/20 text-yellow-400" :
                    order.status === "CONFIRMED" ? "bg-blue-900/20 text-blue-400" :
                    order.status === "DELIVERED" ? "bg-green-900/20 text-green-400" :
                    "bg-gray-900/20 text-[var(--text-muted)]"
                  }`}>
                    {order.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Pending Dealers */}
        <div className="glass border border-[var(--border-color)] rounded-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[var(--text-primary)] font-bold text-lg">Pending Dealers</h2>
            <Link href="/admin/dealers?status=PENDING" className="text-red-400 text-xs font-semibold hover:text-red-300 uppercase tracking-wider">
              View All →
            </Link>
          </div>
          {recentDealers.length === 0 ? (
            <div className="text-center py-8 text-[var(--text-muted)] text-sm">No pending applications</div>
          ) : (
            <div className="space-y-3">
              {recentDealers.map((dealer) => (
                <Link
                  key={dealer.id}
                  href={`/admin/dealers/${dealer.id}`}
                  className="flex items-center gap-3 p-3 glass border border-[var(--border-color)] hover:border-yellow-900/40 rounded-sm transition-all group"
                >
                  <div className="w-8 h-8 bg-yellow-900/20 rounded-sm flex items-center justify-center flex-shrink-0">
                    <Clock size={14} className="text-yellow-500" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[var(--text-primary)] text-xs font-bold truncate">{dealer.companyName}</div>
                    <div className="text-[var(--text-muted)] text-xs">{dealer.city}, {dealer.state}</div>
                    <div className="text-gray-600 text-[10px]">{formatDate(dealer.createdAt)}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
          {pendingDealers > 0 && (
            <Link
              href="/admin/dealers?status=PENDING"
              className="w-full mt-4 flex items-center justify-center gap-2 glass border border-yellow-900/30 hover:border-yellow-600/50 text-yellow-400 font-bold py-2.5 rounded-sm transition-colors text-xs uppercase tracking-wider"
            >
              Review {pendingDealers} Applications
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
