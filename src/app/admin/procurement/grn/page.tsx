import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import Link from "next/link";

export default async function GRNPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const page = parseInt(searchParams.page || "1");
  const pageSize = 20;

  const [grns, total] = await Promise.all([
    prisma.goodsReceivedNote.findMany({
      include: {
        purchaseOrder: {
          select: {
            id: true,
            poNumber: true,
            vendor: { select: { companyName: true } },
          },
        },
        items: true,
      },
      orderBy: { receivedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.goodsReceivedNote.count(),
  ]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight">
          Goods Received Notes
        </h1>
        <p className="text-[var(--text-muted)] mt-1">{total} total GRNs</p>
      </div>

      <div className="glass border border-[var(--border-color)] rounded-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--border-color)]">
              <th className="px-4 py-3 text-left text-xs text-[var(--text-muted)] uppercase tracking-widest">GRN No.</th>
              <th className="px-4 py-3 text-left text-xs text-[var(--text-muted)] uppercase tracking-widest hidden md:table-cell">PO</th>
              <th className="px-4 py-3 text-left text-xs text-[var(--text-muted)] uppercase tracking-widest hidden md:table-cell">Vendor</th>
              <th className="px-4 py-3 text-left text-xs text-[var(--text-muted)] uppercase tracking-widest hidden lg:table-cell">Items</th>
              <th className="px-4 py-3 text-left text-xs text-[var(--text-muted)] uppercase tracking-widest">Quality</th>
              <th className="px-4 py-3 text-left text-xs text-[var(--text-muted)] uppercase tracking-widest">Received</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {grns.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-16 text-center text-[var(--text-muted)] text-sm">No GRNs yet</td>
              </tr>
            ) : (
              grns.map((grn) => (
                <tr key={grn.id} className="hover:bg-white/2 transition-colors">
                  <td className="px-4 py-4">
                    <span className="text-[var(--text-primary)] font-bold font-mono text-sm">{grn.grnNumber}</span>
                    <div className="text-[var(--text-muted)] text-xs mt-0.5">By {grn.receivedByName}</div>
                  </td>
                  <td className="px-4 py-4 hidden md:table-cell">
                    <Link href={`/admin/procurement/purchase-orders/${grn.purchaseOrder.id}`} className="text-[var(--text-muted)] text-xs font-mono hover:text-red-400 transition-colors">
                      {grn.purchaseOrder.poNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-4 hidden md:table-cell">
                    <span className="text-[var(--text-muted)] text-sm">{grn.purchaseOrder.vendor.companyName}</span>
                  </td>
                  <td className="px-4 py-4 hidden lg:table-cell">
                    <span className="text-[var(--text-primary)] font-bold text-sm">{grn.items.length}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`text-xs font-semibold uppercase tracking-wider px-2 py-1 rounded-sm ${
                      grn.qualityStatus === "ACCEPTED" ? "bg-green-900/20 text-green-400" :
                      grn.qualityStatus === "REJECTED" ? "bg-red-900/20 text-red-400" :
                      "bg-yellow-900/20 text-yellow-400"
                    }`}>
                      {grn.qualityStatus}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-[var(--text-muted)] text-sm">{formatDate(grn.receivedAt)}</span>
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
            <Link key={p} href={`/admin/procurement/grn?page=${p}`}
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
