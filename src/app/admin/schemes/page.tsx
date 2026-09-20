import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Plus, ListOrdered } from "lucide-react";
import { SchemesTable } from "@/components/admin/schemes-table";

export default async function AdminSchemesPage(
  props: { searchParams: Promise<{ page?: string }> }
) {
  const searchParams = await props.searchParams;
  const page = parseInt(searchParams.page || "1");
  const pageSize = 20;

  const [schemes, total] = await Promise.all([
    prisma.scheme.findMany({
      include: {
        eligibleCategories: { include: { category: { select: { id: true, name: true } } } },
        _count: { select: { redemptions: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.scheme.count(),
  ]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div>
      <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight">GST Benefit Schemes</h1>
          <p className="text-[var(--text-muted)] mt-1">{total} schemes</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Link
            href="/admin/schemes/redemptions"
            className="flex items-center gap-2 glass border border-[var(--border-color)] text-[var(--text-secondary)] font-bold px-4 py-2.5 rounded-xl transition-colors text-sm hover:border-red-900/40"
          >
            <ListOrdered size={14} />
            Redemptions
          </Link>
          <Link
            href="/admin/schemes/new"
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-2.5 rounded-xl transition-colors text-sm uppercase tracking-wider"
          >
            <Plus size={16} />
            New Scheme
          </Link>
        </div>
      </div>

      <SchemesTable schemes={schemes as any} />

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`/admin/schemes?page=${p}`}
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
