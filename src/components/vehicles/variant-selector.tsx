"use client";

import { useMemo } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

interface VariantOption {
  id: string;
  slug: string;
  name: string;
  emissionStandard: string | null;
  brakeType: string | null;
  startType: string | null;
  yearFrom: number | null;
  yearTo: number | null;
}

interface GenerationOption {
  id: string;
  name: string;
  yearFrom: number;
  yearTo: number | null;
  variants: VariantOption[];
}

export function VariantSelector({
  generations,
  ungroupedVariants,
  selectedGenerationId,
  selectedVariantSlug,
  selectedYear,
}: {
  generations: GenerationOption[];
  ungroupedVariants: VariantOption[];
  selectedGenerationId: string | null;
  selectedVariantSlug: string | null;
  selectedYear: number | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const hasData = generations.length > 0 || ungroupedVariants.length > 0;

  const selectedVariant = useMemo(() => {
    const all = [...generations.flatMap((g) => g.variants), ...ungroupedVariants];
    return all.find((v) => v.slug === selectedVariantSlug) ?? null;
  }, [generations, ungroupedVariants, selectedVariantSlug]);

  if (!hasData) return null;

  function pushParams(next: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function selectGeneration(genId: string | null) {
    pushParams({ generation: genId, variant: null, year: null });
  }

  function selectVariant(variant: VariantOption | null) {
    pushParams({ variant: variant?.slug ?? null });
  }

  return (
    <div className="glass border border-[var(--border-color)] rounded-2xl p-5 space-y-4">
      {generations.length > 0 && (
        <div>
          <div className="text-[var(--text-muted)] text-[10px] uppercase tracking-widest font-semibold mb-2">
            Generation
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => selectGeneration(null)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                !selectedGenerationId
                  ? "bg-red-600 border-red-600 text-white"
                  : "border-[var(--border-color)] text-[var(--text-muted)] hover:text-red-500"
              }`}
            >
              All
            </button>
            {generations.map((g) => (
              <button
                key={g.id}
                onClick={() => selectGeneration(g.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  selectedGenerationId === g.id
                    ? "bg-red-600 border-red-600 text-white"
                    : "border-[var(--border-color)] text-[var(--text-muted)] hover:text-red-500"
                }`}
              >
                {g.name} ({g.yearFrom}–{g.yearTo ?? "present"})
              </button>
            ))}
          </div>
        </div>
      )}

      {(ungroupedVariants.length > 0 ||
        generations.find((g) => g.id === selectedGenerationId)?.variants.length) && (
        <div>
          <div className="text-[var(--text-muted)] text-[10px] uppercase tracking-widest font-semibold mb-2">
            Variant
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => selectVariant(null)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                !selectedVariantSlug
                  ? "bg-red-600 border-red-600 text-white"
                  : "border-[var(--border-color)] text-[var(--text-muted)] hover:text-red-500"
              }`}
            >
              All
            </button>
            {(generations.find((g) => g.id === selectedGenerationId)?.variants ?? ungroupedVariants).map(
              (v) => (
                <button
                  key={v.id}
                  onClick={() => selectVariant(v)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                    selectedVariantSlug === v.slug
                      ? "bg-red-600 border-red-600 text-white"
                      : "border-[var(--border-color)] text-[var(--text-muted)] hover:text-red-500"
                  }`}
                >
                  {v.name}
                </button>
              )
            )}
          </div>
        </div>
      )}

      {selectedVariant && (
        <div className="flex flex-wrap gap-2 pt-1">
          {selectedVariant.emissionStandard && (
            <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500">
              {selectedVariant.emissionStandard.replace("_", " ")}
            </span>
          )}
          {selectedVariant.brakeType && (
            <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-muted)]">
              {selectedVariant.brakeType}
            </span>
          )}
          {selectedVariant.startType && (
            <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-muted)]">
              {selectedVariant.startType}
            </span>
          )}
        </div>
      )}

      {selectedVariant && (selectedVariant.yearFrom || selectedVariant.yearTo) && (
        <div>
          <div className="text-[var(--text-muted)] text-[10px] uppercase tracking-widest font-semibold mb-2">
            Model Year
          </div>
          <select
            value={selectedYear ?? ""}
            onChange={(e) => pushParams({ year: e.target.value || null })}
            className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg px-3 py-1.5 text-sm text-[var(--text-primary)]"
          >
            <option value="">Any year</option>
            {Array.from(
              { length: (selectedVariant.yearTo ?? new Date().getFullYear()) - (selectedVariant.yearFrom ?? 0) + 1 },
              (_, i) => (selectedVariant.yearFrom ?? 0) + i
            ).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
