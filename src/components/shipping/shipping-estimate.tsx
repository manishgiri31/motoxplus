"use client";

import { Truck, Clock, Tag } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface ShippingEstimateProps {
  shippingCost: number;
  estimatedDays: number | null;
  loading?: boolean;
}

export function ShippingEstimate({ shippingCost, estimatedDays, loading }: ShippingEstimateProps) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] animate-pulse">
        <Truck size={14} />
        <span>Calculating shipping...</span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between py-2 border-t border-[var(--border-color)] mt-2">
      <div className="flex items-center gap-2">
        <Truck size={14} className="text-[var(--text-muted)]" />
        <div>
          <span className="text-[var(--text-secondary)] text-sm">Shipping (Delhivery)</span>
          {estimatedDays && (
            <div className="flex items-center gap-1 text-[var(--text-muted)] text-xs mt-0.5">
              <Clock size={11} />
              <span>{estimatedDays} business days</span>
            </div>
          )}
        </div>
      </div>
      <div className="text-right">
        {shippingCost === 0 ? (
          <span className="text-green-400 text-sm font-semibold flex items-center gap-1">
            <Tag size={12} />
            Free
          </span>
        ) : (
          <span className="text-[var(--text-primary)] font-semibold text-sm">
            {formatCurrency(shippingCost)}
          </span>
        )}
      </div>
    </div>
  );
}
