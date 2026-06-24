"use client";

import { Truck } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface ShippingEstimateProps {
  shippingCost: number;
}

export function ShippingEstimate({ shippingCost }: ShippingEstimateProps) {
  return (
    <div className="flex items-center justify-between py-2 border-t border-[var(--border-color)] mt-2">
      <div className="flex items-center gap-2">
        <Truck size={14} className="text-[var(--text-muted)]" />
        <span className="text-[var(--text-secondary)] text-sm">Shipping</span>
      </div>
      <span className="text-[var(--text-primary)] font-semibold text-sm">
        {formatCurrency(shippingCost)}
      </span>
    </div>
  );
}
