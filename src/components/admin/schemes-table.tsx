"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export interface AdminSchemeRow {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  benefitPercent: number;
  minOrderValue: number;
  maxBenefitValue: number | null;
  startsAt: string;
  endsAt: string;
  eligibleCategories: { category: { id: string; name: string } }[];
  _count: { redemptions: number };
}

function isWithinWindow(startsAt: string, endsAt: string): boolean {
  const now = Date.now();
  return now >= new Date(startsAt).getTime() && now <= new Date(endsAt).getTime();
}

export function SchemesTable({ schemes }: { schemes: AdminSchemeRow[] }) {
  const router = useRouter();
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const toggleActive = async (scheme: AdminSchemeRow) => {
    setTogglingId(scheme.id);
    await fetch(`/api/admin/schemes/${scheme.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !scheme.isActive }),
    });
    setTogglingId(null);
    router.refresh();
  };

  if (schemes.length === 0) {
    return (
      <div className="glass border border-[var(--border-color)] rounded-xl p-10 text-center text-[var(--text-muted)]">
        No schemes yet.
      </div>
    );
  }

  return (
    <div className="glass border border-[var(--border-color)] rounded-xl overflow-hidden overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--border-color)] text-left text-[var(--text-muted)] text-xs uppercase tracking-wider">
            <th className="px-4 py-3">Scheme</th>
            <th className="px-4 py-3">Benefit</th>
            <th className="px-4 py-3">Min Order</th>
            <th className="px-4 py-3">Window</th>
            <th className="px-4 py-3">Categories</th>
            <th className="px-4 py-3">Redemptions</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {schemes.map((scheme) => {
            const live = scheme.isActive && isWithinWindow(scheme.startsAt, scheme.endsAt);
            return (
              <tr key={scheme.id} className="border-b border-[var(--border-color)] last:border-0">
                <td className="px-4 py-3">
                  <div className="font-semibold text-[var(--text-primary)]">{scheme.name}</div>
                  <div className="text-[var(--text-muted)] text-xs font-mono">{scheme.code}</div>
                </td>
                <td className="px-4 py-3 text-[var(--text-primary)]">
                  {scheme.benefitPercent}%
                  {scheme.maxBenefitValue != null && (
                    <div className="text-[var(--text-muted)] text-xs">cap {formatCurrency(scheme.maxBenefitValue)}</div>
                  )}
                </td>
                <td className="px-4 py-3 text-[var(--text-primary)]">{formatCurrency(scheme.minOrderValue)}</td>
                <td className="px-4 py-3 text-[var(--text-muted)] text-xs">
                  {new Date(scheme.startsAt).toLocaleDateString("en-IN")} – {new Date(scheme.endsAt).toLocaleDateString("en-IN")}
                </td>
                <td className="px-4 py-3 text-[var(--text-muted)] text-xs">
                  {scheme.eligibleCategories.length === 0 ? "All categories" : scheme.eligibleCategories.map((c) => c.category.name).join(", ")}
                </td>
                <td className="px-4 py-3 text-[var(--text-primary)]">{scheme._count.redemptions}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => toggleActive(scheme)}
                    disabled={togglingId === scheme.id}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors disabled:opacity-50 ${
                      live
                        ? "bg-green-500/10 text-green-400"
                        : scheme.isActive
                        ? "bg-yellow-500/10 text-yellow-400"
                        : "bg-zinc-500/10 text-zinc-400"
                    }`}
                    title={scheme.isActive ? "Click to deactivate" : "Click to activate"}
                  >
                    {live ? "Live" : scheme.isActive ? "Outside window" : "Inactive"}
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/schemes/${scheme.id}/edit`}
                    className="inline-flex items-center gap-1.5 text-[var(--text-muted)] hover:text-red-400 text-xs font-semibold"
                  >
                    <Pencil size={13} />
                    Edit
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
