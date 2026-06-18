import { prisma } from "@/lib/prisma";
import { formatDate, formatCurrency, formatRelativeTime } from "@/lib/utils";
import Link from "next/link";
import { Plus, AlertCircle, Calendar } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  NEW: "bg-blue-900/20 text-blue-400",
  CONTACTED: "bg-cyan-900/20 text-cyan-400",
  INTERESTED: "bg-yellow-900/20 text-yellow-400",
  NEGOTIATION: "bg-orange-900/20 text-orange-400",
  CONVERTED: "bg-green-900/20 text-green-400",
  LOST: "bg-red-900/20 text-red-400",
  DORMANT: "bg-gray-900/20 text-gray-400",
};

const PRIORITY_DOTS: Record<string, string> = {
  LOW: "bg-gray-500",
  MEDIUM: "bg-yellow-400",
  HIGH: "bg-red-500",
};

const ALL_STATUSES = ["NEW", "CONTACTED", "INTERESTED", "NEGOTIATION", "CONVERTED", "LOST", "DORMANT"];

export default async function CRMLeadsPage({
  searchParams,
}: {
  searchParams: { status?: string; page?: string };
}) {
  const page = parseInt(searchParams.page || "1");
  const pageSize = 25;
  const where: any = {};
  if (searchParams.status) where.status = searchParams.status;
  else where.status = { notIn: ["CONVERTED", "LOST"] };

  const now = new Date();

  const [leads, total, counts] = await Promise.all([
    prisma.lead.findMany({
      where,
      include: { _count: { select: { activities: true } } },
      orderBy: [{ priority: "desc" }, { nextFollowUp: "asc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.lead.count({ where }),
    prisma.lead.groupBy({ by: ["status"], _count: true }),
  ]);

  const totalPages = Math.ceil(total / pageSize);
  const countMap = Object.fromEntries(counts.map((c) => [c.status, c._count]));

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight">CRM — Leads</h1>
          <p className="text-[var(--text-muted)] mt-1">
            {countMap.NEW || 0} new · {countMap.NEGOTIATION || 0} in negotiation · {countMap.CONVERTED || 0} converted
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/crm/pipeline"
            className="glass border border-[var(--border-color)] hover:border-red-900/40 text-[var(--text-muted)] font-bold px-4 py-2.5 rounded-sm text-sm uppercase tracking-wider transition-colors"
          >
            Pipeline View
          </Link>
          <Link
            href="/admin/crm/leads/new"
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-2.5 rounded-sm text-sm transition-colors uppercase tracking-wider"
          >
            <Plus size={16} />
            Add Lead
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <Link
          href="/admin/crm/leads"
          className={`px-3 py-2 rounded-sm text-xs font-semibold uppercase tracking-wider transition-colors ${!searchParams.status ? "bg-red-600 text-white" : "glass border border-[var(--border-color)] text-[var(--text-muted)] hover:border-red-600/50"}`}
        >
          Active
        </Link>
        {ALL_STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/crm/leads?status=${s}`}
            className={`px-3 py-2 rounded-sm text-xs font-semibold uppercase tracking-wider transition-colors ${searchParams.status === s ? "bg-red-600 text-white" : "glass border border-[var(--border-color)] text-[var(--text-muted)] hover:border-red-600/50"}`}
          >
            {s} {countMap[s] ? `(${countMap[s]})` : ""}
          </Link>
        ))}
      </div>

      <div className="glass border border-[var(--border-color)] rounded-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--border-color)]">
              <th className="px-4 py-3 text-left text-xs text-[var(--text-muted)] uppercase tracking-widest">Lead</th>
              <th className="px-4 py-3 text-left text-xs text-[var(--text-muted)] uppercase tracking-widest hidden md:table-cell">Contact</th>
              <th className="px-4 py-3 text-left text-xs text-[var(--text-muted)] uppercase tracking-widest hidden lg:table-cell">Location</th>
              <th className="px-4 py-3 text-left text-xs text-[var(--text-muted)] uppercase tracking-widest">Status</th>
              <th className="px-4 py-3 text-left text-xs text-[var(--text-muted)] uppercase tracking-widest hidden lg:table-cell">Follow Up</th>
              <th className="px-4 py-3 text-left text-xs text-[var(--text-muted)] uppercase tracking-widest hidden md:table-cell">Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {leads.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-16 text-center text-[var(--text-muted)] text-sm">No leads found</td>
              </tr>
            ) : (
              leads.map((lead) => {
                const isOverdue = lead.nextFollowUp && new Date(lead.nextFollowUp) < now && !["CONVERTED", "LOST"].includes(lead.status);
                return (
                  <tr key={lead.id} className="hover:bg-white/2 transition-colors">
                    <td className="px-4 py-4">
                      <Link href={`/admin/crm/leads/${lead.id}`}>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${PRIORITY_DOTS[lead.priority]}`} />
                          <div>
                            <div className="text-[var(--text-primary)] font-bold text-sm hover:text-red-400 transition-colors">
                              {lead.companyName}
                            </div>
                            <div className="text-[var(--text-muted)] text-xs">{lead.leadNumber}</div>
                          </div>
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-4 hidden md:table-cell">
                      <div className="text-[var(--text-secondary)] text-sm">{lead.ownerName}</div>
                      <div className="text-[var(--text-muted)] text-xs">{lead.phone}</div>
                    </td>
                    <td className="px-4 py-4 hidden lg:table-cell">
                      <span className="text-[var(--text-muted)] text-sm">{lead.city}, {lead.state}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`text-xs font-semibold uppercase tracking-wider px-2 py-1 rounded-sm ${STATUS_COLORS[lead.status]}`}>
                        {lead.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 hidden lg:table-cell">
                      {lead.nextFollowUp ? (
                        <div className={`flex items-center gap-1 text-xs ${isOverdue ? "text-red-400" : "text-[var(--text-muted)]"}`}>
                          {isOverdue && <AlertCircle size={12} />}
                          <Calendar size={12} />
                          {formatDate(lead.nextFollowUp)}
                        </div>
                      ) : (
                        <span className="text-gray-700 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4 hidden md:table-cell">
                      {lead.estimatedValue ? (
                        <span className="text-[var(--text-primary)] font-bold text-sm">{formatCurrency(lead.estimatedValue)}/mo</span>
                      ) : (
                        <span className="text-gray-700 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Link key={p} href={`/admin/crm/leads?page=${p}${searchParams.status ? `&status=${searchParams.status}` : ""}`}
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
