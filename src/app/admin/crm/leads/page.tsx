import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import { Plus, AlertCircle, Calendar } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { FilterChips, FilterChip } from "@/components/ui/filter-chips";
import { DataTable, type Column } from "@/components/ui/data-table";
import { StatusBadge, StatusDot } from "@/components/ui/status-badge";
import { Pagination } from "@/components/ui/pagination";
import { Money } from "@/components/ui/numeral";
import { Button } from "@/components/ui/button";
import type { LeadPriority, LeadStatus } from "@prisma/client";

const ALL_STATUSES: LeadStatus[] = ["NEW", "CONTACTED", "INTERESTED", "NEGOTIATION", "CONVERTED", "LOST", "DORMANT"];

interface LeadRow {
  id: string;
  leadNumber: string;
  companyName: string;
  ownerName: string;
  phone: string;
  city: string;
  state: string;
  status: LeadStatus;
  priority: LeadPriority;
  nextFollowUp: Date | null;
  estimatedValue: number | null;
}

export default async function CRMLeadsPage(props: { searchParams: Promise<{ status?: string; page?: string }> }) {
  const searchParams = await props.searchParams;
  const page = parseInt(searchParams.page || "1");
  const pageSize = 25;
  const where: Record<string, unknown> = {};
  if (searchParams.status) where.status = searchParams.status;
  else where.status = { notIn: ["CONVERTED", "LOST"] };

  const now = new Date();

  const [leads, total, counts] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy: [{ priority: "desc" }, { nextFollowUp: "asc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.lead.count({ where }),
    prisma.lead.groupBy({ by: ["status"], _count: true }),
  ]);

  const totalPages = Math.ceil(total / pageSize);
  const countMap = Object.fromEntries(counts.map((c) => [c.status, c._count])) as Record<string, number>;

  const hrefFor = (target: { status?: string; page?: number }) => {
    const params = new URLSearchParams();
    if (target.status) params.set("status", target.status);
    if (target.page && target.page > 1) params.set("page", String(target.page));
    const qs = params.toString();
    return `/admin/crm/leads${qs ? `?${qs}` : ""}`;
  };

  const columns: Column<LeadRow>[] = [
    {
      key: "lead",
      header: "Lead",
      cell: (lead) => (
        <div className="flex items-center gap-2.5">
          <StatusDot domain="leadPriority" value={lead.priority} />
          <div>
            <div className="font-bold text-sm text-[var(--text-primary)]">{lead.companyName}</div>
            <div className="text-xs text-[var(--text-muted)]">{lead.leadNumber}</div>
          </div>
        </div>
      ),
    },
    {
      key: "contact",
      header: "Contact",
      hideBelow: "md",
      cell: (lead) => (
        <div>
          <div className="text-sm text-[var(--text-secondary)]">{lead.ownerName}</div>
          <div className="text-xs text-[var(--text-muted)]">{lead.phone}</div>
        </div>
      ),
    },
    {
      key: "location",
      header: "Location",
      hideBelow: "lg",
      cell: (lead) => (
        <span className="text-sm text-[var(--text-muted)]">
          {lead.city}, {lead.state}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (lead) => <StatusBadge domain="lead" value={lead.status} />,
    },
    {
      key: "followUp",
      header: "Follow Up",
      hideBelow: "lg",
      cell: (lead) => {
        if (!lead.nextFollowUp) return <span className="text-[var(--text-faint)] text-xs">—</span>;
        const isOverdue = new Date(lead.nextFollowUp) < now && !["CONVERTED", "LOST"].includes(lead.status);
        return (
          <div className={`flex items-center gap-1 text-xs ${isOverdue ? "text-[var(--sig-danger-fg)]" : "text-[var(--text-muted)]"}`}>
            {isOverdue && <AlertCircle size={12} />}
            <Calendar size={12} />
            {formatDate(lead.nextFollowUp)}
          </div>
        );
      },
    },
    {
      key: "value",
      header: "Value",
      hideBelow: "md",
      numeric: true,
      cell: (lead) =>
        lead.estimatedValue ? (
          <span className="font-bold text-sm text-[var(--text-primary)]">
            <Money amount={lead.estimatedValue} />/mo
          </span>
        ) : (
          <span className="text-[var(--text-faint)] text-xs">—</span>
        ),
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="CUSTOMER RELATIONSHIP"
        title="CRM — Leads"
        description={`${countMap.NEW || 0} new · ${countMap.NEGOTIATION || 0} in negotiation · ${countMap.CONVERTED || 0} converted`}
        actions={
          <>
            <Button asChild variant="secondary" size="md">
              <Link href="/admin/crm/pipeline">Pipeline View</Link>
            </Button>
            <Button asChild variant="primary" size="md" icon={<Plus size={16} />}>
              <Link href="/admin/crm/leads/new">Add Lead</Link>
            </Button>
          </>
        }
      />

      <FilterChips className="mb-6">
        <FilterChip href={hrefFor({})} active={!searchParams.status}>
          Active
        </FilterChip>
        {ALL_STATUSES.map((s) => (
          <FilterChip key={s} href={hrefFor({ status: s })} active={searchParams.status === s} count={countMap[s]}>
            {s}
          </FilterChip>
        ))}
      </FilterChips>

      <DataTable<LeadRow>
        columns={columns}
        rows={leads}
        rowHref={(lead) => `/admin/crm/leads/${lead.id}`}
        caption="Leads"
        empty={<div className="py-16 text-center text-sm text-[var(--text-muted)]">No leads found</div>}
        footer={
          totalPages > 1 ? (
            <Pagination
              page={page}
              totalPages={totalPages}
              totalItems={total}
              pageSize={pageSize}
              hrefFor={(p) => hrefFor({ status: searchParams.status, page: p })}
            />
          ) : undefined
        }
      />
    </div>
  );
}
