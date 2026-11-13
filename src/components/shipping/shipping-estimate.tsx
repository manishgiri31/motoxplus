"use client";

import { Truck } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface ShippingEstimateProps {
  /** null = not known yet (no pincode, quote loading or failed) — `note` is shown instead. */
  shippingCost: number | null;
  /** Shows "Free" instead of ₹0.00. */
  free?: boolean;
  note?: string;
}

export function ShippingEstimate({ shippingCost, free = false, note }: ShippingEstimateProps) {
  return (
    <div className="flex items-center justify-between py-2 border-t border-[var(--border-color)] mt-2">
      <div className="flex items-center gap-2">
        <Truck size={14} className="text-[var(--text-muted)]" />
        <span className="text-[var(--text-secondary)] text-sm">Shipping</span>
      </div>
      {shippingCost === null ? (
        <span className="text-[var(--text-muted)] text-sm" aria-live="polite">{note ?? "—"}</span>
      ) : free ? (
        <span className="text-green-400 font-semibold text-sm">Free</span>
      ) : (
        <span className="text-[var(--text-primary)] font-semibold text-sm">{formatCurrency(shippingCost)}</span>
      )}
    </div>
  );
}
