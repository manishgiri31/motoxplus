"use client";

import { useState, useMemo } from "react";
import { Search, X } from "lucide-react";
import { VehicleCard, type VehicleCardData } from "@/components/vehicles/vehicle-card";

export function VehicleGrid({ vehicles, categorySlug }: { vehicles: VehicleCardData[]; categorySlug: string }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return vehicles;
    return vehicles.filter(
      (v) => v.name.toLowerCase().includes(q) || v.manufacturer.name.toLowerCase().includes(q)
    );
  }, [vehicles, query]);

  return (
    <div>
      <div className="relative max-w-md mb-10">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search model or manufacturer…"
          className="w-full pl-11 pr-10 py-3 rounded-full glass border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-red-500/50 transition-colors"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-red-500"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-24">
          <p className="text-[var(--text-muted)]">No models match &quot;{query}&quot;.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filtered.map((v) => (
            <VehicleCard key={v.slug} vehicle={v} categorySlug={categorySlug} />
          ))}
        </div>
      )}
    </div>
  );
}
