import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/utils";
import Link from "next/link";
import { AdminOrderStatus } from "@/components/admin/order-status";

const statusColors: Record<string, string> = {
  PENDING: "bg-yellow-900/20 text-yellow-400",
  CONFIRMED: "bg-blue-900/20 text-blue-400",
  PROCESSING: "bg-purple-900/20 text-purple-400",
  SHIPPED: "bg-indigo-900/20 text-indigo-400",
  DELIVERED: "bg-green-900/20 text-green-400",
  CANCELLED: "bg-red-900/20 text-red-400",
};

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: { page?: string; status?: string };
}) {
  const page = parseInt(searchParams.page || "1");
  const pageSize = 20;

  const where: any = {};
  if (searchParams.status) where.status = searchParams.status;

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: { dealer: { include: { user: true } }, invoice: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.order.count({ where }),
  ]);

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight">Orders</h1>
          <p className="text-[var(--text-muted)] mt-1">{total} total orders</p>
        </div>
      </div>

      {/* Status filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        {[null, "PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"].map((s) => (
          <Link
            key={s || "all"}
            href={`/admin/orders${s ? `?status=${s}` : ""}`}
            className={`px-3 py-2 rounded-sm text-xs font-semibold uppercase tracking-wider transition-colors ${
              searchParams.status === s || (!searchParams.status && !s)
                ? "bg-red-600 text-white"
                : "glass border border-[var(--border-color)] text-[var(--text-muted)] hover:border-red-600/50"
            }`}
          >
            {s || "All"}
          </Link>
        ))}
      </div>

      <div className="glass border border-[var(--border-color)] rounded-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--border-color)]">
              <th className="px-4 py-3 text-left text-xs text-[var(--text-muted)] uppercase tracking-widest">Order</th>
              <th className="px-4 py-3 text-left text-xs text-[var(--text-muted)] uppercase tracking-widest hidden md:table-cell">Dealer</th>
              <th className="px-4 py-3 text-left text-xs text-[var(--text-muted)] uppercase tracking-widest hidden lg:table-cell">Date</th>
              <th className="px-4 py-3 text-right text-xs text-[var(--text-muted)] uppercase tracking-widest">Amount</th>
              <th className="px-4 py-3 text-left text-xs text-[var(--text-muted)] uppercase tracking-widest">Status</th>
              <th className="px-4 py-3 text-left text-xs text-[var(--text-muted)] uppercase tracking-widest">Update</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {orders.map((order) => (
              <tr key={order.id} className="hover:bg-white/2 transition-colors">
                <td className="px-4 py-4">
                  <Link href={`/admin/orders/${order.id}`} className="text-[var(--text-primary)] font-mono font-bold text-sm hover:text-red-400 transition-colors">
                    {order.orderNumber}
                  </Link>
                  {order.invoice && (
                    <div className="text-[10px] text-green-500 mt-0.5">Invoice generated</div>
                  )}
                </td>
                <td className="px-4 py-4 hidden md:table-cell">
                  <div className="text-[var(--text-primary)] text-sm">{(order.dealer as any).companyName}</div>
                  <div className="text-[var(--text-muted)] text-xs">{(order.dealer as any).user?.email}</div>
                </td>
                <td className="px-4 py-4 hidden lg:table-cell">
                  <span className="text-[var(--text-muted)] text-sm">{formatDate(order.createdAt)}</span>
                </td>
                <td className="px-4 py-4 text-right">
                  <div className="text-[var(--text-primary)] font-bold text-sm">{formatCurrency(order.grandTotal)}</div>
                  <div className={`text-[10px] ${order.paymentStatus === "PAID" ? "text-green-400" : order.paymentStatus === "PARTIAL" ? "text-yellow-400" : "text-[var(--text-muted)]"}`}>
                    {order.paymentStatus}
                  </div>
                </td>
                <td className="px-4 py-4">
                  <span className={`text-xs font-semibold uppercase tracking-wider px-2 py-1 rounded-sm ${statusColors[order.status] || "bg-gray-900/20 text-[var(--text-muted)]"}`}>
                    {order.status}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <AdminOrderStatus orderId={order.id} currentStatus={order.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
