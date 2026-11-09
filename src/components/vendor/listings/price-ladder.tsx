import { cn } from "@/lib/utils";
import { payoutEstimate, percent, rupees } from "@/lib/vendor/listings";

/**
 * The three prices drawn to scale against the MRP, with what the vendor keeps from each kind of sale. It answers the
 * two questions a vendor has while pricing: "are these in the right order?" (a bar longer than the one above it turns
 * red) and "what do I actually get?" (commission comes from configuration, never hard-coded here).
 */
export function PriceLadder({
  mrp,
  retail,
  dealer,
  commissionBp,
  errors,
}: {
  mrp: number | null;
  retail: number | null;
  dealer: number | null;
  commissionBp: number | null;
  errors: { retailPrice?: string; dealerPrice?: string };
}) {
  if (mrp == null && retail == null && dealer == null) return null;
  const scale = Math.max(mrp ?? 0, retail ?? 0, dealer ?? 0);

  const rows: { key: string; label: string; value: number | null; channel?: string; bad?: boolean }[] = [
    { key: "mrp", label: "MRP", value: mrp },
    { key: "retail", label: "Retail", value: retail, channel: "per retail sale", bad: !!errors.retailPrice },
    { key: "dealer", label: "Dealer", value: dealer, channel: "per dealer sale", bad: !!errors.dealerPrice },
  ];

  return (
    <div className="mt-5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-4 py-4 md:px-5">
      <dl className="space-y-3.5">
        {rows.map((r) => {
          const est = r.value != null && r.channel && commissionBp != null && !r.bad ? payoutEstimate(r.value, commissionBp) : null;
          return (
            <div key={r.key} className="grid grid-cols-[64px_minmax(0,1fr)] items-center gap-x-4 gap-y-1 sm:grid-cols-[64px_minmax(0,1fr)_minmax(0,190px)]">
              <dt className="text-12 font-semibold uppercase tracking-[0.06em] text-[var(--text-muted)]">{r.label}</dt>
              <dd className="flex min-w-0 items-center gap-3">
                <span className={cn("tnum w-[84px] shrink-0 text-right text-14 font-semibold", r.bad ? "text-[var(--sig-danger-fg)]" : "text-[var(--text-primary)]")}>
                  {r.value != null ? rupees(r.value) : "—"}
                </span>
                <span aria-hidden className="relative h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--border-subtle)]">
                  {r.value != null && scale > 0 && (
                    <span
                      className={cn(
                        "absolute inset-y-0 left-0 rounded-full transition-[width] duration-[var(--dur-2)]",
                        r.bad ? "bg-[var(--sig-danger-fg)]" : r.key === "mrp" ? "bg-[var(--text-muted)]" : "bg-[var(--text-primary)]"
                      )}
                      style={{ width: `${Math.max(2, (r.value / scale) * 100)}%` }}
                    />
                  )}
                </span>
              </dd>
              <dd className="col-start-2 text-12 text-[var(--text-muted)] sm:col-start-auto sm:text-right">
                {est && (
                  <>
                    You get <span className="tnum font-semibold text-[var(--text-primary)]">{rupees(est.payout)}</span> {r.channel}
                  </>
                )}
              </dd>
            </div>
          );
        })}
      </dl>
      {commissionBp != null && (
        <p className="mt-4 border-t border-[var(--border-subtle)] pt-3 text-12 leading-relaxed text-[var(--text-muted)]">
          MotoXPlus keeps {percent(commissionBp)} of the selling price on each sale. Estimates before GST and shipping.
        </p>
      )}
    </div>
  );
}
