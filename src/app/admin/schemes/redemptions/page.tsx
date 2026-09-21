import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";

const STATUS_STYLE: Record<string, string> = {
  ACTIVE: "bg-green-500/10 text-green-400",
  ADJUSTED: "bg-yellow-500/10 text-yellow-400",
  CANCELLED: "bg-zinc-500/10 text-zinc-400",
};

export default async function SchemeRedemptionsPage(
  props: { searchParams: Promise<{ page?: string; schemeId?: string }> }
) {
  const searchParams = await props.searchParams;
  const page = parseInt(searchParams.page || "1");
  const pageSize = 25;
  const schemeId = searchParams.schemeId;

  const [redemptions, total, schemes] = await Promise.all([
    prisma.schemeRedemption.findMany({
      where: schemeId ? { schemeId } : {},
      include: {
        scheme: { select: { id: true, name: true, code: true } },
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            grandTotal: true,
            schemeAdjustmentAmount: true,
            createdAt: true,
            dealer: { select: { companyName: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.schemeRedemption.count({ where: schemeId ? { schemeId } : {} }),
    prisma.scheme.findMany({ select: { id: true, name: true, code: true }, orderBy: { createdAt: "desc" } }),
  ]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div>
      <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight">Scheme Redemptions</h1>
          <p className="text-[var(--text-muted)] mt-1">{total} redemptions</p>
        </div>
        <Link
          href="/admin/schemes"
          className="glass border border-[var(--border-color)] text-[var(--text-secondary)] font-bold px-4 py-2.5 rounded-xl transition-colors text-sm hover:border-red-900/40"
        >
          Back to Schemes
        </Link>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <Link
          href="/admin/schemes/redemptions"
          className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${!schemeId ? "bg-red-600 text-white" : "glass border border-[var(--border-color)] text-[var(--text-muted)]"}`}
        >
          All
        </Link>
        {schemes.map((s) => (
          <Link
            key={s.id}
            href={`/admin/schemes/redemptions?schemeId=${s.id}`}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${schemeId === s.id ? "bg-red-600 text-white" : "glass border border-[var(--border-color)] text-[var(--text-muted)]"}`}
          >
            {s.code}
          </Link>
        ))}
      </div>

      <div className="glass border border-[var(--border-color)] rounded-xl overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border-color)] text-left text-[var(--text-muted)] text-xs uppercase tracking-wider">
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">Dealer</th>
              <th className="px-4 py-3">Scheme</th>
              <th className="px-4 py-3">Benefit Value</th>
              <th className="px-4 py-3">Items Value</th>
              <th className="px-4 py-3">Adjustment</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {redemptions.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-[var(--text-muted)]">
                  No redemptions yet.
                </td>
              </tr>
            )}
            {redemptions.map((r) => (
              <tr key={r.id} className="border-b border-[var(--border-color)] last:border-0">
                <td className="px-4 py-3">
                  <Link href={`/admin/orders/${r.order.id}`} className="text-[var(--text-primary)] font-semibold hover:text-red-400">
                    #{r.order.orderNumber}
                  </Link>
                </td>
                <td className="px-4 py-3 text-[var(--text-primary)]">{r.order.dealer?.companyName ?? "—"}</td>
                <td className="px-4 py-3 text-[var(--text-muted)]">
                  {r.scheme.name} <span className="font-mono text-xs">({r.scheme.code})</span>
                </td>
                <td className="px-4 py-3 text-[var(--text-primary)]">{formatCurrency(r.benefitValue)}</td>
                <td className="px-4 py-3 text-[var(--text-primary)]">{formatCurrency(r.itemsValue)}</td>
                <td className="px-4 py-3 text-[var(--text-primary)]">
                  {r.order.schemeAdjustmentAmount > 0 ? formatCurrency(r.order.schemeAdjustmentAmount) : "—"}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${STATUS_STYLE[r.status]}`}>
                    {r.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-[var(--text-muted)] text-xs">{r.createdAt.toLocaleDateString("en-IN")}</td>
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
              href={`/admin/schemes/redemptions?${new URLSearchParams({ page: String(p), ...(schemeId && { schemeId }) }).toString()}`}
              className={`w-10 h-10 flex items-center justify-center rounded-xl text-sm font-bold transition-colors ${p === page ? "bg-red-600 text-white" : "glass border border-[var(--border-color)] text-[var(--text-muted)] hover:border-red-600/50 hover:text-white"}`}
            >
              {p}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
