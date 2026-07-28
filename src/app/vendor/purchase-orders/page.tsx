import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { formatDate } from "@/lib/utils";
import { VendorPOActions } from "@/components/vendor/vendor-po-actions";
import { ClipboardList } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Money, PartNo, Numeral } from "@/components/ui/numeral";
import { SpecTable } from "@/components/ui/technical";

export default async function VendorPurchaseOrdersPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "VENDOR") redirect("/login");

  const vendor = await prisma.vendor.findUnique({
    where: { userId: session.user.id },
  });
  if (!vendor) redirect("/login");

  const pos = await prisma.purchaseOrder.findMany({
    where: { vendorId: vendor.id },
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });

  const pending = pos.filter((p) => p.status === "SENT").length;

  return (
    <div>
      <PageHeader
        eyebrow="PROCUREMENT"
        title="Purchase Orders"
        description={
          <>
            <Numeral value={pos.length} /> total
            {pending > 0 && (
              <>
                {" "}
                · <span className="font-semibold text-[var(--sig-info-fg)]"><Numeral value={pending} /> awaiting your response</span>
              </>
            )}
          </>
        }
      />

      {pos.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No purchase orders yet"
          description="Orders from MOTOXPLUS will appear here."
        />
      ) : (
        <div className="space-y-4">
          {pos.map((po) => (
            <Card key={po.id} edge={po.status === "SENT" ? "tone" : "none"} tone="info" pad="lg">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap mb-3">
                    <PartNo className="font-black text-base text-[var(--text-primary)]">{po.poNumber}</PartNo>
                    <StatusBadge domain="purchaseOrder" value={po.status} />
                    {po.urgency !== "NORMAL" && <StatusBadge domain="urgency" value={po.urgency} />}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <div className="text-[var(--text-muted)] text-[10px] uppercase tracking-eyebrow mb-0.5">Value</div>
                      <div className="text-[var(--text-primary)] font-bold text-sm"><Money amount={po.grandTotal} /></div>
                    </div>
                    <div>
                      <div className="text-[var(--text-muted)] text-[10px] uppercase tracking-eyebrow mb-0.5">Items</div>
                      <div className="text-[var(--text-primary)] font-bold text-sm"><Numeral value={po.items.length} /></div>
                    </div>
                    <div>
                      <div className="text-[var(--text-muted)] text-[10px] uppercase tracking-eyebrow mb-0.5">Deliver By</div>
                      <div className="text-[var(--text-primary)] font-bold text-sm">{formatDate(po.deliveryDate)}</div>
                    </div>
                    <div>
                      <div className="text-[var(--text-muted)] text-[10px] uppercase tracking-eyebrow mb-0.5">Received</div>
                      <div className="text-[var(--text-primary)] font-bold text-sm">{formatDate(po.createdAt)}</div>
                    </div>
                  </div>

                  {po.status === "SENT" && (
                    <Card elevation="flat" pad="sm" className="mt-4 bg-[var(--sig-info-bg)] border-[var(--sig-info-bd)]">
                      <p className="text-[var(--sig-info-fg)] text-xs font-medium">
                        Action required — please accept or reject this purchase order
                      </p>
                    </Card>
                  )}

                  {po.vendorNotes && po.status === "REJECTED" && (
                    <div className="mt-3 text-[var(--text-muted)] text-xs">Your note: {po.vendorNotes}</div>
                  )}

                  {po.termsAndConditions && (
                    <details className="mt-3">
                      <summary className="text-[var(--text-muted)] text-xs cursor-pointer hover:text-[var(--text-primary)] transition-colors">
                        View Terms & Conditions
                      </summary>
                      <p className="text-[var(--text-muted)] text-xs mt-2 pl-2 border-l border-[var(--border-color)]">
                        {po.termsAndConditions}
                      </p>
                    </details>
                  )}
                </div>

                <div className="flex-shrink-0">{po.status === "SENT" && <VendorPOActions poId={po.id} />}</div>
              </div>

              {/* Line items collapsible */}
              <details className="mt-4">
                <summary className="text-[var(--text-muted)] text-xs cursor-pointer hover:text-[var(--text-primary)] transition-colors uppercase tracking-eyebrow">
                  View {po.items.length} item{po.items.length !== 1 ? "s" : ""}
                </summary>
                <SpecTable
                  dense
                  className="mt-2"
                  rows={po.items.map((item) => ({
                    label: item.description,
                    value: <Money amount={item.total} />,
                    note: `${item.quantity} ${item.unit}`,
                  }))}
                />
              </details>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
