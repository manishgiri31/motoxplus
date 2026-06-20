import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/utils";
import Link from "next/link";
import {
  ShoppingCart,
  ClipboardList,
  FileText,
  TrendingUp,
  ArrowRight,
  ChevronRight,
  Package,
  LayoutGrid,
} from "lucide-react";

const statusStyle: Record<string, string> = {
  DELIVERED: "bg-green-500/10 text-green-400 border border-green-500/20",
  PENDING:   "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20",
  CONFIRMED: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
  CANCELLED: "bg-red-500/10 text-red-400 border border-red-500/20",
};

export default async function DealerDashboardPage() {
  const session = await getServerSession(authOptions);
  const dealer = await prisma.dealer.findUnique({
    where: { userId: session!.user.id },
    include: {
      orders: {
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { invoice: true },
      },
    },
  });

  if (!dealer) return null;

  const stats = {
    totalOrders: await prisma.order.count({ where: { dealerId: dealer.id } }),
    pendingOrders: await prisma.order.count({ where: { dealerId: dealer.id, status: "PENDING" } }),
    totalSpent: await prisma.payment.aggregate({
      _sum: { amount: true },
      where: { order: { dealerId: dealer.id }, status: "PAID" },
    }),
    cartItems: await prisma.cartItem.count({
      where: { cart: { dealerId: dealer.id } },
    }),
  };

  const statCards = [
    {
      icon: ClipboardList,
      label: "Total Orders",
      value: stats.totalOrders,
      href: "/dealer/orders",
      iconColor: "text-blue-400",
      iconBg: "bg-blue-500/10",
      accent: "border-l-blue-500/60",
    },
    {
      icon: TrendingUp,
      label: "Pending Orders",
      value: stats.pendingOrders,
      href: "/dealer/orders",
      iconColor: "text-yellow-400",
      iconBg: "bg-yellow-500/10",
      accent: "border-l-yellow-500/60",
    },
    {
      icon: FileText,
      label: "Total Spent",
      value: formatCurrency(stats.totalSpent._sum.amount || 0),
      href: "/dealer/invoices",
      iconColor: "text-green-400",
      iconBg: "bg-green-500/10",
      accent: "border-l-green-500/60",
    },
    {
      icon: ShoppingCart,
      label: "Cart Items",
      value: stats.cartItems,
      href: "/dealer/cart",
      iconColor: "text-red-400",
      iconBg: "bg-red-500/10",
      accent: "border-l-red-500/60",
    },
  ];

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-black text-[var(--text-primary)] tracking-tight">
          Welcome, <span className="text-gradient-red">{dealer.ownerName}.</span>
        </h1>
        <p className="text-[var(--text-muted)] mt-1 text-sm">{dealer.companyName}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className={`group glass border border-[var(--border-color)] hover:border-red-900/40 rounded-2xl p-5 transition-all duration-200 card-hover border-l-4 ${stat.accent}`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`w-9 h-9 rounded-xl ${stat.iconBg} flex items-center justify-center`}>
                <stat.icon size={18} className={stat.iconColor} />
              </div>
              <ChevronRight size={14} className="text-[var(--text-muted)] group-hover:text-red-500 transition-colors" />
            </div>
            <div className="text-2xl font-black text-[var(--text-primary)] mb-0.5">{stat.value}</div>
            <div className="text-[var(--text-muted)] text-[10px] uppercase tracking-widest font-semibold">{stat.label}</div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Recent Orders */}
        <div className="lg:col-span-2 glass border border-[var(--border-color)] rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-[var(--text-primary)] font-bold text-base">Recent Orders</h2>
            <Link href="/dealer/orders" className="flex items-center gap-1 text-red-400 text-xs font-semibold hover:text-red-300 transition-colors uppercase tracking-wider">
              View All <ArrowRight size={12} />
            </Link>
          </div>

          {dealer.orders.length === 0 ? (
            <div className="text-center py-10">
              <div className="w-12 h-12 bg-[var(--bg-card)] rounded-2xl flex items-center justify-center mx-auto mb-3">
                <ClipboardList size={22} className="text-[var(--text-muted)]" />
              </div>
              <p className="text-[var(--text-muted)] text-sm mb-2">No orders yet.</p>
              <Link href="/dealer/products" className="text-red-400 text-sm hover:text-red-300 transition-colors">
                Browse Products →
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {dealer.orders.map((order) => (
                <Link
                  key={order.id}
                  href={`/dealer/orders/${order.id}`}
                  className="flex items-center justify-between p-3.5 rounded-xl border border-[var(--border-color)] hover:border-red-900/30 hover:bg-[var(--bg-card-hover)] transition-all group"
                >
                  <div>
                    <div className="text-[var(--text-primary)] font-mono text-sm font-bold">{order.orderNumber}</div>
                    <div className="text-[var(--text-muted)] text-[10px] mt-0.5">{formatDate(order.createdAt)}</div>
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
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Quick Actions */}
          <div className="glass border border-[var(--border-color)] rounded-2xl p-5">
            <h2 className="text-[var(--text-primary)] font-bold text-base mb-4">Quick Actions</h2>
            <div className="space-y-1.5">
              {[
                { label: "Browse Products", href: "/dealer/products", icon: Package },
                { label: "View Cart", href: "/dealer/cart", icon: ShoppingCart },
                { label: "My Orders", href: "/dealer/orders", icon: ClipboardList },
                { label: "Download Invoices", href: "/dealer/invoices", icon: FileText },
              ].map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-[var(--border-color)] hover:border-red-900/40 hover:bg-[var(--bg-card-hover)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all group"
                >
                  <action.icon size={15} className="text-[var(--text-muted)] group-hover:text-red-500 transition-colors flex-shrink-0" />
                  {action.label}
                  <ArrowRight size={13} className="ml-auto text-[var(--text-muted)] group-hover:text-red-500 transition-colors" />
                </Link>
              ))}
            </div>
          </div>

          {/* Account info */}
          <div className="glass border border-[var(--border-color)] rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <LayoutGrid size={14} className="text-[var(--text-muted)]" />
              <h3 className="text-[var(--text-primary)] font-bold text-sm">Account Details</h3>
            </div>
            <div className="space-y-3">
              {[
                { label: "GST Number", value: dealer.gstNumber, mono: true },
                { label: "State", value: dealer.state },
                { label: "City", value: dealer.city },
              ].map((item) => (
                <div key={item.label} className="flex justify-between items-center">
                  <span className="text-[var(--text-muted)] text-xs">{item.label}</span>
                  <span className={`text-[var(--text-primary)] text-xs font-semibold ${item.mono ? "font-mono" : ""}`}>
                    {item.value}
                  </span>
                </div>
              ))}
              <div className="flex justify-between items-center pt-1 border-t border-[var(--border-color)]">
                <span className="text-[var(--text-muted)] text-xs">Status</span>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full text-green-400 bg-green-500/10 border border-green-500/20">
                  APPROVED
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
