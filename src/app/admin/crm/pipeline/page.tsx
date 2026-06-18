import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/utils";
import Link from "next/link";
import { Plus, AlertCircle } from "lucide-react";

const STAGES = [
  { key: "NEW", label: "New", color: "border-t-blue-500" },
  { key: "CONTACTED", label: "Contacted", color: "border-t-cyan-500" },
  { key: "INTERESTED", label: "Interested", color: "border-t-yellow-500" },
  { key: "NEGOTIATION", label: "Negotiation", color: "border-t-orange-500" },
  { key: "DORMANT", label: "Dormant", color: "border-t-gray-500" },
];

const PRIORITY_DOT: Record<string, string> = {
  LOW: "bg-gray-500",
  MEDIUM: "bg-yellow-400",
  HIGH: "bg-red-500",
};

export default async function CRMPipelinePage() {
  const leads = await prisma.lead.findMany({
    where: { status: { notIn: ["CONVERTED", "LOST"] } },
    orderBy: [{ priority: "desc" }, { nextFollowUp: "asc" }],
    include: { _count: { select: { activities: true } } },
  });

  const now = new Date();
  const byStage = Object.fromEntries(STAGES.map((s) => [s.key, leads.filter((l) => l.status === s.key)]));

  const totalValue = leads.reduce((sum, l) => sum + (Number(l.estimatedValue) || 0), 0);

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight">Pipeline</h1>
          <p className="text-[var(--text-muted)] mt-1">
            {leads.length} active leads · {totalValue > 0 ? `${formatCurrency(totalValue)}/mo pipeline` : "no estimated value"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/admin/crm/leads" className="glass border border-[var(--border-color)] hover:border-red-900/40 text-[var(--text-muted)] font-bold px-4 py-2.5 rounded-sm text-sm uppercase tracking-wider transition-colors">
            List View
          </Link>
          <Link href="/admin/crm/leads/new" className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-2.5 rounded-sm text-sm uppercase tracking-wider transition-colors">
            <Plus size={16} /> Add Lead
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 items-start">
        {STAGES.map((stage) => {
          const stageLeads = byStage[stage.key] || [];
          const stageValue = stageLeads.reduce((sum, l) => sum + (Number(l.estimatedValue) || 0), 0);

          return (
            <div key={stage.key}>
              <div className={`glass border border-[var(--border-color)] border-t-2 ${stage.color} rounded-sm`}>
                <div className="px-3 py-3 border-b border-[var(--border-color)]">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest">{stage.label}</span>
                    <span className="text-xs font-bold text-[var(--text-muted)] bg-white/5 px-1.5 py-0.5 rounded-sm">{stageLeads.length}</span>
                  </div>
                  {stageValue > 0 && <p className="text-xs text-[var(--text-muted)]">{formatCurrency(stageValue)}/mo</p>}
                </div>

                <div className="p-2 space-y-2 min-h-24">
                  {stageLeads.length === 0 && (
                    <p className="text-center text-gray-700 text-xs py-6">Empty</p>
                  )}
                  {stageLeads.map((lead) => {
                    const isOverdue = lead.nextFollowUp && new Date(lead.nextFollowUp) < now;
                    return (
                      <Link key={lead.id} href={`/admin/crm/leads/${lead.id}`}>
                        <div className="glass border border-[var(--border-color)] hover:border-red-900/40 rounded-sm p-3 cursor-pointer transition-all hover:bg-white/3">
                          <div className="flex items-start gap-1.5 mb-1.5">
                            <div className={`w-1.5 h-1.5 rounded-full mt-1 flex-shrink-0 ${PRIORITY_DOT[lead.priority]}`} />
                            <p className="text-[var(--text-primary)] text-xs font-bold leading-snug">{lead.companyName}</p>
                          </div>
                          <p className="text-[var(--text-muted)] text-xs mb-2 pl-3">{lead.city}, {lead.state}</p>
                          <div className="pl-3 flex items-center justify-between">
                            {lead.estimatedValue ? (
                              <span className="text-xs text-[var(--text-secondary)] font-semibold">{formatCurrency(lead.estimatedValue)}</span>
                            ) : <span />}
                            {lead.nextFollowUp && (
                              <span className={`text-xs flex items-center gap-0.5 ${isOverdue ? "text-red-400" : "text-gray-600"}`}>
                                {isOverdue && <AlertCircle size={10} />}
                                {formatDate(lead.nextFollowUp)}
                              </span>
                            )}
                          </div>
                          {lead._count.activities > 0 && (
                            <p className="text-gray-700 text-xs pl-3 mt-1">{lead._count.activities} activities</p>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
