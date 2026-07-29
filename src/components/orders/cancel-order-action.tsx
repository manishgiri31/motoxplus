"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";

type Stage = "PRE_SHIP" | "POST_SHIP";

type Preview =
  | {
      allowed: true;
      stage: Stage;
      chargePercent: number;
      chargeAmount: number;
      grandTotal: number;
      amountPaid: number;
      refundAmount: number;
      waived: boolean;
    }
  | { allowed: false; grandTotal: number; amountPaid: number; reason: string };

const REASON_OPTIONS = [
  { value: "CHANGED_MIND", label: "Changed my mind" },
  { value: "ORDERED_BY_MISTAKE", label: "Ordered by mistake" },
  { value: "FOUND_BETTER_PRICE", label: "Found a better price" },
  { value: "DELIVERY_TOO_SLOW", label: "Delivery too slow" },
  { value: "OTHER", label: "Other" },
];

/**
 * Cancel flow shared by the dealer order-detail page and the admin order-detail
 * page: preview -> confirm dialog with a full charge breakdown -> submit. Built
 * on the existing Dialog primitives (Radix, same as ConfirmDialog in dialog.tsx)
 * rather than adding @radix-ui/react-alert-dialog — they provide the same
 * modal/focus-trap/overlay behavior an AlertDialog would, and this needs a
 * custom body (the breakdown table) that ConfirmDialog itself doesn't support.
 *
 * allowWaive is gated server-side too (POST /cancel silently ignores waive:true
 * from any role outside SUPER_ADMIN/ACCOUNTS) — this prop only controls whether
 * the toggle renders, not whether waiving is honored.
 */
export function CancelOrderAction({ orderId, allowWaive = false }: { orderId: string; allowWaive?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [reasonCode, setReasonCode] = useState("CHANGED_MIND");
  const [reasonText, setReasonText] = useState("");
  const [waive, setWaive] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [staleNotice, setStaleNotice] = useState(false);

  const openDialog = async () => {
    setOpen(true);
    setLoadingPreview(true);
    setError(null);
    setStaleNotice(false);
    setWaive(false);
    try {
      const res = await fetch(`/api/orders/${orderId}/cancellation-preview`);
      setPreview(await res.json());
    } catch {
      setError("Could not load cancellation terms. Please try again.");
    } finally {
      setLoadingPreview(false);
    }
  };

  const confirmCancel = async () => {
    if (!preview?.allowed) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reasonCode,
          reason: reasonText || undefined,
          expectedStage: preview.stage,
          waive: allowWaive && waive,
        }),
      });
      const data = await res.json();

      if (res.status === 409 && data.preview) {
        setPreview(data.preview);
        setStaleNotice(true);
        return;
      }
      if (!res.ok) {
        setError(data.error || "Could not cancel this order.");
        return;
      }

      setOpen(false);
      router.refresh();
    } catch {
      setError("Could not cancel this order. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Button variant="ghost" size="sm" onClick={openDialog} className="border-[var(--red)] text-[var(--red)]">
        Cancel Order
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md bg-[var(--card)] border-[var(--line)] rounded-[var(--radius-panel)]">
          <DialogHeader>
            <DialogTitle className="font-display text-[var(--ink)]">Cancel this order?</DialogTitle>
          </DialogHeader>

          {loadingPreview && (
            <div className="flex items-center justify-center gap-2 text-[var(--muted)] text-sm py-8">
              <Loader2 size={16} className="animate-spin" />
              Checking cancellation terms…
            </div>
          )}

          {!loadingPreview && error && (
            <p className="text-[var(--red)] text-sm py-2">{error}</p>
          )}

          {!loadingPreview && !error && preview && !preview.allowed && (
            <div className="py-2">
              <p className="text-sm text-[var(--ink)] mb-4 leading-relaxed">{preview.reason}</p>
              <Link href="/contact" className="text-[var(--red)] text-sm font-semibold hover:underline">
                Contact support →
              </Link>
            </div>
          )}

          {!loadingPreview && !error && preview && preview.allowed && (
            <div className="py-2">
              {staleNotice && (
                <div className="mb-4 flex items-start gap-2 bg-[var(--red-soft)] text-[var(--red)] text-xs rounded-[var(--radius-input)] px-3 py-2.5">
                  <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
                  This order was dispatched — the charge has changed. Please review before confirming.
                </div>
              )}

              {allowWaive && (
                <label className="mb-4 flex items-center gap-2.5 cursor-pointer select-none bg-[var(--paper)] border border-[var(--line)] rounded-[var(--radius-input)] px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={waive}
                    onChange={(e) => setWaive(e.target.checked)}
                    className="accent-[var(--red)]"
                  />
                  <span className="text-[var(--ink)] text-xs font-semibold">
                    Waive charge (refunds the full amount paid — logged under your admin account)
                  </span>
                </label>
              )}

              <div className="space-y-2 text-sm mb-5">
                <Row label="Order total" value={formatCurrency(preview.grandTotal)} />
                <Row label="Amount paid" value={formatCurrency(preview.amountPaid)} />
                <Row
                  label={
                    waive
                      ? "Cancellation charge (waived by admin)"
                      : preview.waived
                      ? "Cancellation charge (waived)"
                      : `Cancellation charge (${preview.chargePercent}%${
                          preview.stage === "POST_SHIP" ? " — order already dispatched" : ""
                        })`
                  }
                  value={`−${formatCurrency(waive ? 0 : preview.chargeAmount)}`}
                  tone="red"
                />
                <div className="border-t border-[var(--line)] pt-2">
                  <Row label="Refund to you" value={formatCurrency(waive ? preview.amountPaid : preview.refundAmount)} bold />
                </div>
              </div>

              <div className="space-y-3 mb-5">
                <div>
                  <label className="text-[var(--muted)] text-xs uppercase tracking-wider block mb-1.5">Reason</label>
                  <select
                    value={reasonCode}
                    onChange={(e) => setReasonCode(e.target.value)}
                    className="w-full border border-[var(--line)] rounded-[var(--radius-input)] px-3 py-2 text-sm text-[var(--ink)] bg-[var(--paper)] outline-none focus-visible:outline-2 focus-visible:outline-[var(--red)] focus-visible:outline-offset-1"
                  >
                    {REASON_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <textarea
                  value={reasonText}
                  onChange={(e) => setReasonText(e.target.value)}
                  placeholder="Anything else you'd like to add (optional)"
                  rows={2}
                  maxLength={500}
                  className="w-full border border-[var(--line)] rounded-[var(--radius-input)] px-3 py-2 text-sm text-[var(--ink)] bg-[var(--paper)] outline-none resize-none focus-visible:outline-2 focus-visible:outline-[var(--red)] focus-visible:outline-offset-1"
                />
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={submitting}>
                  Never mind
                </Button>
                <Button variant="brand" onClick={confirmCancel} loading={submitting}>
                  {waive
                    ? "Cancel order & waive charge"
                    : `Cancel order & accept ${formatCurrency(preview.chargeAmount)} charge`}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Row({ label, value, tone, bold }: { label: string; value: string; tone?: "red"; bold?: boolean }) {
  return (
    <div className="flex justify-between items-baseline gap-3">
      <span className={bold ? "text-[var(--ink)] font-display font-bold" : "text-[var(--muted)]"}>{label}</span>
      {bold ? (
        // "Refund to you" is the one amount spec'd as font-display, not font-mono.
        <span className="text-right font-display font-bold text-base text-[var(--ink)]">{value}</span>
      ) : (
        <span className={`text-right font-mono ${tone === "red" ? "text-[var(--red)]" : "text-[var(--ink)]"}`}>{value}</span>
      )}
    </div>
  );
}
