import { prisma } from "@/lib/prisma";
import { formatDate, formatCurrency } from "@/lib/utils";
import Link from "next/link";
import { Plus } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-900/20 text-gray-400",
  SENT: "bg-blue-900/20 text-blue-400",
  ACCEPTED: "bg-green-900/20 text-green-400",
  REJECTED: "bg-red-900/20 text-red-400",
  PARTIALLY_RECEIVED: "bg-yellow-900/20 text-yellow-400",
  FULLY_RECEIVED: "bg-emerald-900/20 text-emerald-400",
  CANCELLED: "bg-gray-900/20 text-gray-500",
  CLOSED: "bg-purple-900/20 text-purple-400",
};

const ALL_STATUSES = ["SENT", "ACCEPTED", "PARTIALLY_RECEIVED", "FULLY_RECEIVED", "REJECTED", "CLOSED"];

export default async function PurchaseOrdersPage(
  props: {
    searchParams: Promise<{ status?: string; page?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const page = parseInt(searchParams.page || "1");
  const pageSize = 20;
  const where: any = {};
  if (searchParams.status) where.status = searchParams.status;

  const [orders, total] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where,
      include: {
        vendor: { select: { id: true, companyName: true, vendorCode: true } },
        items: true,
        _count: { select: { goodsReceivedNotes: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.purchaseOrder.count({ where }),
  ]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight">Purchase Orders</h1>
          <p className="text-[var(--text-muted)] mt-1">{total} total orders</p>
        </div>
        <Link
          href="/admin/procurement/purchase-orders/new"
          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-2.5 rounded-sm text-sm transition-colors uppercase tracking-wider"
        >
          <Plus size={16} />
          New PO
        </Link>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <Link
          href="/admin/procurement/purchase-orders"
          className={`px-3 py-2 rounded-sm text-xs font-semibold uppercase tracking-wider transition-colors ${!searchParams.status ? "bg-red-600 text-white" : "glass border border-[var(--border-color)] text-[var(--text-muted)] hover:border-red-600/50"}`}
        >
          All
        </Link>
        {ALL_STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/procurement/purchase-orders?status=${s}`}
            className={`px-3 py-2 rounded-sm text-xs font-semibold uppercase tracking-wider transition-colors ${searchParams.status === s ? "bg-red-600 text-white" : "glass border border-[var(--border-color)] text-[var(--text-muted)] hover:border-red-600/50"}`}
          >
            {s.replace("_", " ")}
          </Link>
        ))}
      </div>

      <div className="glass border border-[var(--border-color)] rounded-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--border-color)]">
              <th className="px-4 py-3 text-left text-xs text-[var(--text-muted)] uppercase tracking-widest">PO Number</th>
              <th className="px-4 py-3 text-left text-xs text-[var(--text-muted)] uppercase tracking-widest hidden md:table-cell">Vendor</th>
              <th className="px-4 py-3 text-left text-xs text-[var(--text-muted)] uppercase tracking-widest hidden lg:table-cell">Delivery By</th>
              <th className="px-4 py-3 text-left text-xs text-[var(--text-muted)] uppercase tracking-widest hidden md:table-cell">Value</th>
              <th className="px-4 py-3 text-left text-xs text-[var(--text-muted)] uppercase tracking-widest hidden lg:table-cell">GRNs</th>
              <th className="px-4 py-3 text-left text-xs text-[var(--text-muted)] uppercase tracking-widest">Status</th>
              <th className="px-4 py-3 text-left text-xs text-[var(--text-muted)] uppercase tracking-widest">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {orders.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-16 text-center text-[var(--text-muted)] text-sm">No purchase orders found</td>
              </tr>
            ) : (
              orders.map((po) => (
                <tr key={po.id} className="hover:bg-white/2 transition-colors">
                  <td className="px-4 py-4">
                    <Link href={`/admin/procurement/purchase-orders/${po.id}`}>
                      <div className="text-[var(--text-primary)] font-bold font-mono text-sm hover:text-red-400 transition-colors">
                        {po.poNumber}
                      </div>
                      <div className="text-[var(--text-muted)] text-xs">{po.items.length} item{po.items.length !== 1 ? "s" : ""}</div>
                    </Link>
                  </td>
                  <td className="px-4 py-4 hidden md:table-cell">
                    <Link href={`/admin/vendors/${po.vendor.id}`}>
                      <div className="text-[var(--text-primary)] text-sm hover:text-red-400 transition-colors">{po.vendor.companyName}</div>
                      <div className="text-[var(--text-muted)] text-xs font-mono">{po.vendor.vendorCode}</div>
                    </Link>
                  </td>
                  <td className="px-4 py-4 hidden lg:table-cell">
                    <span className="text-[var(--text-muted)] text-sm">{formatDate(po.deliveryDate)}</span>
                  </td>
                  <td className="px-4 py-4 hidden md:table-cell">
                    <span className="text-[var(--text-primary)] font-bold text-sm">{formatCurrency(po.grandTotal)}</span>
                  </td>
                  <td className="px-4 py-4 hidden lg:table-cell">
                    <span className="text-[var(--text-primary)] font-bold text-sm">{po._count.goodsReceivedNotes}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`text-xs font-semibold uppercase tracking-wider px-2 py-1 rounded-sm ${STATUS_COLORS[po.status] || "bg-gray-900/20 text-gray-400"}`}>
                      {po.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <Link href={`/admin/procurement/purchase-orders/${po.id}`} className="text-xs font-semibold text-[var(--text-muted)] hover:text-red-400 uppercase tracking-wider transition-colors">
                      View
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Link key={p} href={`/admin/procurement/purchase-orders?page=${p}${searchParams.status ? `&status=${searchParams.status}` : ""}`}
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
