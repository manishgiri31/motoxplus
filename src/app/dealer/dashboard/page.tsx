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
} from "lucide-react";

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

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight">
          Welcome, <span className="text-gradient-red">{dealer.ownerName}.</span>
        </h1>
        <p className="text-[var(--text-muted)] mt-1">{dealer.companyName}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          {
            icon: ClipboardList,
            label: "Total Orders",
            value: stats.totalOrders,
            href: "/dealer/orders",
            color: "text-blue-400",
          },
          {
            icon: TrendingUp,
            label: "Pending Orders",
            value: stats.pendingOrders,
            href: "/dealer/orders",
            color: "text-yellow-400",
          },
          {
            icon: FileText,
            label: "Total Spent",
            value: formatCurrency(stats.totalSpent._sum.amount || 0),
            href: "/dealer/invoices",
            color: "text-green-400",
          },
          {
            icon: ShoppingCart,
            label: "Cart Items",
            value: stats.cartItems,
            href: "/dealer/cart",
            color: "text-red-400",
          },
        ].map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="group glass border border-[var(--border-color)] hover:border-red-900/40 rounded-sm p-6 transition-all duration-200 card-hover"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`w-10 h-10 rounded-sm bg-[var(--bg-card)] flex items-center justify-center`}>
                <stat.icon size={20} className={stat.color} />
              </div>
              <ArrowRight size={14} className="text-gray-700 group-hover:text-red-500 transition-colors" />
            </div>
            <div className="text-2xl font-black text-[var(--text-primary)] mb-1">{stat.value}</div>
            <div className="text-[var(--text-muted)] text-xs uppercase tracking-widest">{stat.label}</div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Orders */}
        <div className="lg:col-span-2 glass border border-[var(--border-color)] rounded-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[var(--text-primary)] font-bold text-lg">Recent Orders</h2>
            <Link href="/dealer/orders" className="text-red-400 text-xs font-semibold hover:text-red-300 transition-colors uppercase tracking-wider">
              View All →
            </Link>
          </div>

          {dealer.orders.length === 0 ? (
            <div className="text-center py-10">
              <ClipboardList size={32} className="text-gray-700 mx-auto mb-3" />
              <p className="text-[var(--text-muted)] text-sm">No orders yet.</p>
              <Link href="/dealer/products" className="text-red-400 text-sm hover:text-red-300 mt-2 inline-block">
                Browse Products →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {dealer.orders.map((order) => (
                <Link
                  key={order.id}
                  href={`/dealer/orders/${order.id}`}
                  className="flex items-center justify-between p-4 glass border border-[var(--border-color)] hover:border-red-900/30 rounded-sm transition-all group"
                >
                  <div>
                    <div className="text-[var(--text-primary)] font-mono text-sm font-bold">{order.orderNumber}</div>
                    <div className="text-[var(--text-muted)] text-xs mt-1">{formatDate(order.createdAt)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[var(--text-primary)] font-bold text-sm">{formatCurrency(order.grandTotal)}</div>
                    <span className={`text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded-sm ${
                      order.status === "DELIVERED" ? "bg-green-900/20 text-green-400" :
                      order.status === "PENDING" ? "bg-yellow-900/20 text-yellow-400" :
                      order.status === "CONFIRMED" ? "bg-blue-900/20 text-blue-400" :
                      order.status === "CANCELLED" ? "bg-red-900/20 text-red-400" :
                      "bg-gray-900/20 text-[var(--text-muted)]"
                    }`}>
                      {order.status}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="space-y-4">
          <div className="glass border border-[var(--border-color)] rounded-sm p-6">
            <h2 className="text-[var(--text-primary)] font-bold text-lg mb-4">Quick Actions</h2>
            <div className="space-y-3">
              {[
                { label: "Browse Products", href: "/dealer/products", icon: "◈" },
                { label: "View Cart", href: "/dealer/cart", icon: "◉" },
                { label: "My Orders", href: "/dealer/orders", icon: "⬡" },
                { label: "Download Invoices", href: "/dealer/invoices", icon: "⬢" },
              ].map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className="flex items-center gap-3 px-4 py-3 glass border border-[var(--border-color)] hover:border-red-900/40 rounded-sm text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all group"
                >
                  <span className="text-red-800 group-hover:text-red-600 font-black">{action.icon}</span>
                  {action.label}
                  <ArrowRight size={14} className="ml-auto text-gray-700 group-hover:text-red-500 transition-colors" />
                </Link>
              ))}
            </div>
          </div>

          {/* Account info */}
          <div className="glass border border-[var(--border-color)] rounded-sm p-6">
            <h3 className="text-[var(--text-primary)] font-bold mb-4">Account Details</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">GST Number</span>
                <span className="text-[var(--text-primary)] font-mono text-xs">{dealer.gstNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">State</span>
                <span className="text-[var(--text-primary)]">{dealer.state}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">City</span>
                <span className="text-[var(--text-primary)]">{dealer.city}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Status</span>
                <span className="text-green-400 font-semibold text-xs uppercase">APPROVED</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
