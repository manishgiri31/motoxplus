import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import Link from "next/link";
import { AdminDealerActions } from "@/components/admin/dealer-actions";

const statusColors: Record<string, string> = {
  PENDING: "bg-yellow-900/20 text-yellow-400",
  APPROVED: "bg-green-900/20 text-green-400",
  REJECTED: "bg-red-900/20 text-red-400",
  SUSPENDED: "bg-orange-900/20 text-orange-400",
};

export default async function AdminDealersPage({
  searchParams,
}: {
  searchParams: { status?: string; page?: string };
}) {
  const page = parseInt(searchParams.page || "1");
  const pageSize = 20;

  const where: any = {};
  if (searchParams.status) where.status = searchParams.status;

  const [dealers, total] = await Promise.all([
    prisma.dealer.findMany({
      where,
      include: { user: true, _count: { select: { orders: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.dealer.count({ where }),
  ]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight">Dealers</h1>
          <p className="text-[var(--text-muted)] mt-1">{total} total dealers</p>
        </div>
      </div>

      {/* Status filters */}
      <div className="flex gap-2 mb-6">
        {[null, "PENDING", "APPROVED", "REJECTED", "SUSPENDED"].map((s) => (
          <Link
            key={s || "all"}
            href={`/admin/dealers${s ? `?status=${s}` : ""}`}
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
              <th className="px-4 py-3 text-left text-xs text-[var(--text-muted)] uppercase tracking-widest">Company</th>
              <th className="px-4 py-3 text-left text-xs text-[var(--text-muted)] uppercase tracking-widest hidden md:table-cell">GST</th>
              <th className="px-4 py-3 text-left text-xs text-[var(--text-muted)] uppercase tracking-widest hidden lg:table-cell">Location</th>
              <th className="px-4 py-3 text-left text-xs text-[var(--text-muted)] uppercase tracking-widest hidden md:table-cell">Orders</th>
              <th className="px-4 py-3 text-left text-xs text-[var(--text-muted)] uppercase tracking-widest">Status</th>
              <th className="px-4 py-3 text-left text-xs text-[var(--text-muted)] uppercase tracking-widest">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {dealers.map((dealer) => (
              <tr key={dealer.id} className="hover:bg-white/2 transition-colors">
                <td className="px-4 py-4">
                  <Link href={`/admin/dealers/${dealer.id}`}>
                    <div className="text-[var(--text-primary)] font-bold text-sm hover:text-red-400 transition-colors">{dealer.companyName}</div>
                    <div className="text-[var(--text-muted)] text-xs">{dealer.ownerName}</div>
                    <div className="text-gray-600 text-xs">{dealer.user.email}</div>
                  </Link>
                </td>
                <td className="px-4 py-4 hidden md:table-cell">
                  <span className="text-[var(--text-muted)] text-xs font-mono">{dealer.gstNumber}</span>
                </td>
                <td className="px-4 py-4 hidden lg:table-cell">
                  <span className="text-[var(--text-muted)] text-xs">{dealer.city}, {dealer.state}</span>
                </td>
                <td className="px-4 py-4 hidden md:table-cell">
                  <span className="text-[var(--text-primary)] font-bold text-sm">{dealer._count.orders}</span>
                </td>
                <td className="px-4 py-4">
                  <span className={`text-xs font-semibold uppercase tracking-wider px-2 py-1 rounded-sm ${statusColors[dealer.status] || "bg-gray-900/20 text-[var(--text-muted)]"}`}>
                    {dealer.status}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <AdminDealerActions dealerId={dealer.id} currentStatus={dealer.status} />
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
              href={`/admin/dealers?page=${p}${searchParams.status ? `&status=${searchParams.status}` : ""}`}
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
