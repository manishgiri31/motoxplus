import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { formatDate, formatCurrency, formatRelativeTime } from "@/lib/utils";
import Link from "next/link";
import { ArrowLeft, Phone, Mail, MapPin, Calendar, AlertCircle, CheckCircle } from "lucide-react";
import { LeadDetailActions } from "./lead-detail-actions";

const STATUS_COLORS: Record<string, string> = {
  NEW: "bg-blue-900/20 text-blue-400",
  CONTACTED: "bg-cyan-900/20 text-cyan-400",
  INTERESTED: "bg-yellow-900/20 text-yellow-400",
  NEGOTIATION: "bg-orange-900/20 text-orange-400",
  CONVERTED: "bg-green-900/20 text-green-400",
  LOST: "bg-red-900/20 text-red-400",
  DORMANT: "bg-gray-900/20 text-gray-400",
};

const ACTIVITY_ICONS: Record<string, string> = {
  CALL: "📞",
  EMAIL: "📧",
  VISIT: "🚗",
  DEMO: "🖥",
  PROPOSAL: "📄",
  FOLLOW_UP: "🔄",
  MEETING: "🤝",
  OTHER: "📌",
};

const OUTCOME_COLORS: Record<string, string> = {
  POSITIVE: "text-green-400",
  NEUTRAL: "text-yellow-400",
  NEGATIVE: "text-red-400",
};

export default async function LeadDetailPage({ params }: { params: { id: string } }) {
  const lead = await prisma.lead.findUnique({
    where: { id: params.id },
    include: {
      activities: { orderBy: { createdAt: "desc" } },
      notes: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!lead) notFound();

  const isOverdue = lead.nextFollowUp && new Date(lead.nextFollowUp) < new Date() && !["CONVERTED", "LOST"].includes(lead.status);
  const isConverted = lead.status === "CONVERTED";

  return (
    <div>
      <div className="mb-6">
        <Link href="/admin/crm/leads" className="flex items-center gap-2 text-[var(--text-muted)] hover:text-red-400 text-sm font-semibold uppercase tracking-wider mb-4 transition-colors">
          <ArrowLeft size={14} /> Back to Leads
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight">{lead.companyName}</h1>
              <span className={`text-xs font-semibold uppercase tracking-wider px-2 py-1 rounded-sm ${STATUS_COLORS[lead.status]}`}>{lead.status}</span>
            </div>
            <p className="text-[var(--text-muted)] text-sm">{lead.leadNumber} · Added {formatRelativeTime(lead.createdAt)}</p>
          </div>
          {!isConverted && <LeadDetailActions lead={lead} />}
          {isConverted && lead.dealerId && (
            <Link href={`/admin/dealers/${lead.dealerId}`} className="flex items-center gap-2 bg-green-700 hover:bg-green-600 text-white font-bold px-4 py-2.5 rounded-sm text-sm uppercase tracking-wider transition-colors">
              <CheckCircle size={14} /> View Dealer Account
            </Link>
          )}
        </div>
      </div>

      {isOverdue && (
        <div className="mb-6 flex items-center gap-2 bg-red-900/10 border border-red-900/40 text-red-400 px-4 py-3 rounded-sm text-sm">
          <AlertCircle size={16} />
          Follow-up was due {formatDate(lead.nextFollowUp!)} — overdue
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Info cards */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass border border-[var(--border-color)] rounded-sm p-5 space-y-3">
            <h2 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest">Contact</h2>
            <div>
              <p className="text-[var(--text-primary)] font-bold">{lead.ownerName}</p>
              {lead.designation && <p className="text-[var(--text-muted)] text-sm">{lead.designation}</p>}
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                <Phone size={14} className="text-[var(--text-muted)]" />
                {lead.phone}
              </div>
              {lead.alternatePhone && (
                <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                  <Phone size={14} />
                  {lead.alternatePhone}
                </div>
              )}
              <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                <Mail size={14} className="text-[var(--text-muted)]" />
                {lead.email}
              </div>
              <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                <MapPin size={14} />
                {lead.city}, {lead.state}
                {lead.pincode && ` - ${lead.pincode}`}
              </div>
            </div>
          </div>

          <div className="glass border border-[var(--border-color)] rounded-sm p-5 space-y-3">
            <h2 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest">Lead Details</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Source</span>
                <span className="text-[var(--text-secondary)] font-semibold">{lead.source.replace(/_/g, " ")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Priority</span>
                <span className={`font-bold ${lead.priority === "HIGH" ? "text-red-400" : lead.priority === "MEDIUM" ? "text-yellow-400" : "text-gray-400"}`}>
                  {lead.priority}
                </span>
              </div>
              {lead.estimatedValue && (
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Est. Value</span>
                  <span className="text-[var(--text-primary)] font-bold">{formatCurrency(lead.estimatedValue)}/mo</span>
                </div>
              )}
              {lead.nextFollowUp && (
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Next Follow-up</span>
                  <span className={`font-semibold flex items-center gap-1 ${isOverdue ? "text-red-400" : "text-[var(--text-secondary)]"}`}>
                    {isOverdue && <AlertCircle size={12} />}
                    <Calendar size={12} />
                    {formatDate(lead.nextFollowUp)}
                  </span>
                </div>
              )}
              {lead.convertedAt && (
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Converted</span>
                  <span className="text-green-400 font-semibold">{formatDate(lead.convertedAt)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          <div className="glass border border-[var(--border-color)] rounded-sm p-5 space-y-3">
            <h2 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest">Notes ({lead.notes.length})</h2>
            {lead.notes.length === 0 ? (
              <p className="text-[var(--text-muted)] text-sm">No notes yet</p>
            ) : (
              <div className="space-y-3">
                {lead.notes.map((note) => (
                  <div key={note.id} className="border-l-2 border-[var(--border-color)] pl-3">
                    <p className="text-[var(--text-secondary)] text-sm">{note.content}</p>
                    <p className="text-[var(--text-muted)] text-xs mt-1">{note.authorName} · {formatRelativeTime(note.createdAt)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Activity timeline */}
        <div className="lg:col-span-2">
          <div className="glass border border-[var(--border-color)] rounded-sm p-5">
            <h2 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest mb-5">Activity Timeline ({lead.activities.length})</h2>
            {lead.activities.length === 0 ? (
              <p className="text-[var(--text-muted)] text-sm">No activities logged yet. Add one above.</p>
            ) : (
              <div className="space-y-4">
                {lead.activities.map((act, i) => (
                  <div key={act.id} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-9 h-9 rounded-full glass border border-[var(--border-color)] flex items-center justify-center text-lg flex-shrink-0">
                        {ACTIVITY_ICONS[act.type] || "📌"}
                      </div>
                      {i < lead.activities.length - 1 && (
                        <div className="w-px flex-1 bg-[var(--border-color)] mt-2" />
                      )}
                    </div>
                    <div className="flex-1 pb-4">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[var(--text-primary)] font-bold text-sm">{act.type.replace(/_/g, " ")}</span>
                        <span className="text-[var(--text-muted)] text-xs">{formatRelativeTime(act.createdAt)}</span>
                      </div>
                      <p className="text-[var(--text-secondary)] text-sm mb-1">{act.description}</p>
                      {act.outcome && (
                        <span className={`text-xs font-semibold ${OUTCOME_COLORS[act.outcome]}`}>● {act.outcome}</span>
                      )}
                      {act.nextAction && (
                        <p className="text-[var(--text-muted)] text-xs mt-1">→ {act.nextAction}</p>
                      )}
                      <p className="text-gray-700 text-xs mt-1">{act.performedByName}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
