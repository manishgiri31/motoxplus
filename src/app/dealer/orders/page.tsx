import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/utils";
import Link from "next/link";
import { ClipboardList } from "lucide-react";

const statusColors: Record<string, string> = {
  PENDING: "bg-yellow-900/20 text-yellow-400",
  CONFIRMED: "bg-blue-900/20 text-blue-400",
  PROCESSING: "bg-purple-900/20 text-purple-400",
  SHIPPED: "bg-indigo-900/20 text-indigo-400",
  DELIVERED: "bg-green-900/20 text-green-400",
  CANCELLED: "bg-red-900/20 text-red-400",
};

export default async function OrdersPage(
  props: {
    searchParams: Promise<{ page?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const session = await getServerSession(authOptions);
  const dealer = await prisma.dealer.findUnique({ where: { userId: session!.user.id } });

  if (!dealer) return null;

  const page = parseInt(searchParams.page || "1");
  const pageSize = 10;

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where: { dealerId: dealer.id },
      include: { invoice: true, items: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.order.count({ where: { dealerId: dealer.id } }),
  ]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight">My Orders</h1>
        <p className="text-[var(--text-muted)] mt-1">{total} total orders</p>
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-20 glass border border-[var(--border-color)] rounded-xl">
          <ClipboardList size={48} className="text-gray-700 mx-auto mb-4" />
          <h2 className="text-[var(--text-primary)] font-bold text-xl mb-2">No orders yet</h2>
          <Link href="/dealer/products" className="text-red-400 hover:text-red-300 transition-colors">
            Browse Products →
          </Link>
        </div>
      ) : (
        <>
          <div className="glass border border-[var(--border-color)] rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border-color)]">
                  <th className="px-4 py-3 text-left text-xs text-[var(--text-muted)] uppercase tracking-widest">Order</th>
                  <th className="px-4 py-3 text-left text-xs text-[var(--text-muted)] uppercase tracking-widest hidden md:table-cell">Date</th>
                  <th className="px-4 py-3 text-left text-xs text-[var(--text-muted)] uppercase tracking-widest hidden sm:table-cell">Items</th>
                  <th className="px-4 py-3 text-left text-xs text-[var(--text-muted)] uppercase tracking-widest">Amount</th>
                  <th className="px-4 py-3 text-left text-xs text-[var(--text-muted)] uppercase tracking-widest">Status</th>
                  <th className="px-4 py-3 text-left text-xs text-[var(--text-muted)] uppercase tracking-widest">Invoice</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-white/2 transition-colors">
                    <td className="px-4 py-4">
                      <Link href={`/dealer/orders/${order.id}`} className="text-[var(--text-primary)] font-mono font-bold text-sm hover:text-red-400 transition-colors">
                        {order.orderNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-4 hidden md:table-cell">
                      <span className="text-[var(--text-muted)] text-sm">{formatDate(order.createdAt)}</span>
                    </td>
                    <td className="px-4 py-4 hidden sm:table-cell">
                      <span className="text-[var(--text-muted)] text-sm">{order.items.length} items</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-[var(--text-primary)] font-bold text-sm">{formatCurrency(order.grandTotal)}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`text-xs font-semibold uppercase tracking-wider px-2 py-1 rounded-xl ${statusColors[order.status] || "bg-gray-900/20 text-[var(--text-muted)]"}`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {order.invoice ? (
                        <Link
                          href={`/dealer/invoices/${order.invoice.id}`}
                          className="text-red-400 hover:text-red-300 text-xs font-semibold transition-colors"
                        >
                          Download
                        </Link>
                      ) : (
                        <span className="text-gray-600 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <Link
                  key={p}
                  href={`/dealer/orders?page=${p}`}
                  className={`w-10 h-10 flex items-center justify-center rounded-xl text-sm font-bold transition-colors ${
                    p === page ? "bg-red-600 text-white" : "glass border border-[var(--border-color)] text-[var(--text-muted)] hover:border-red-600/50"
                  }`}
                >
                  {p}
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
