"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";

export interface SchemeFormCategory {
  id: string;
  name: string;
}

export interface SchemeFormInitial {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  benefitPercent: number;
  minOrderValue: number;
  maxBenefitValue: number | null;
  startsAt: string;
  endsAt: string;
  eligibleCategories: { category: { id: string } }[];
}

function toDateInputValue(iso?: string): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

export function SchemeForm({ categories, scheme }: { categories: SchemeFormCategory[]; scheme?: SchemeFormInitial }) {
  const router = useRouter();
  const isEdit = !!scheme;

  const [name, setName] = useState(scheme?.name ?? "");
  const [code, setCode] = useState(scheme?.code ?? "");
  const [isActive, setIsActive] = useState(scheme?.isActive ?? true);
  const [benefitPercent, setBenefitPercent] = useState(scheme?.benefitPercent ?? 18);
  const [minOrderValue, setMinOrderValue] = useState(scheme?.minOrderValue ?? 10000);
  const [maxBenefitValue, setMaxBenefitValue] = useState<string>(
    scheme?.maxBenefitValue != null ? String(scheme.maxBenefitValue) : ""
  );
  const [startsAt, setStartsAt] = useState(toDateInputValue(scheme?.startsAt));
  const [endsAt, setEndsAt] = useState(toDateInputValue(scheme?.endsAt));
  const [categoryIds, setCategoryIds] = useState<Set<string>>(
    new Set(scheme?.eligibleCategories.map((c) => c.category.id) ?? [])
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleCategory = (id: string) => {
    setCategoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      name,
      code,
      isActive,
      benefitPercent: Number(benefitPercent),
      minOrderValue: Number(minOrderValue),
      maxBenefitValue: maxBenefitValue.trim() === "" ? null : Number(maxBenefitValue),
      startsAt: startsAt ? new Date(startsAt).toISOString() : undefined,
      endsAt: endsAt ? new Date(`${endsAt}T23:59:59`).toISOString() : undefined,
      categoryIds: Array.from(categoryIds),
    };

    const res = await fetch(isEdit ? `/api/admin/schemes/${scheme!.id}` : "/api/admin/schemes", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to save scheme");
      setSaving(false);
      return;
    }

    router.push("/admin/schemes");
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
      {error && (
        <div className="bg-red-900/20 border border-red-900/40 text-red-400 text-sm rounded-xl px-4 py-3">{error}</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-1.5">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-red-600"
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-1.5">Code</label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            required
            className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-red-600 font-mono"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-1.5">Benefit %</label>
          <input
            type="number"
            step="0.01"
            min={0}
            max={100}
            value={benefitPercent}
            onChange={(e) => setBenefitPercent(Number(e.target.value))}
            required
            className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-red-600"
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-1.5">Min Order Value (₹)</label>
          <input
            type="number"
            step="0.01"
            min={0}
            value={minOrderValue}
            onChange={(e) => setMinOrderValue(Number(e.target.value))}
            required
            className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-red-600"
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-1.5">Max Benefit (₹, optional)</label>
          <input
            type="number"
            step="0.01"
            min={0}
            value={maxBenefitValue}
            onChange={(e) => setMaxBenefitValue(e.target.value)}
            placeholder="No cap"
            className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-red-600"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-1.5">Starts</label>
          <input
            type="date"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            required
            className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-red-600"
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-1.5">Ends</label>
          <input
            type="date"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            required
            className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-red-600"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-2">
          Eligible Categories <span className="normal-case text-[var(--text-muted)]/70">(none selected = every category eligible)</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              type="button"
              key={cat.id}
              onClick={() => toggleCategory(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                categoryIds.has(cat.id)
                  ? "bg-red-600 text-white"
                  : "glass border border-[var(--border-color)] text-[var(--text-muted)] hover:border-red-600/50"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
        Active
      </label>

      <button
        type="submit"
        disabled={saving}
        className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-3 rounded-xl transition-colors text-sm uppercase tracking-wider disabled:opacity-60"
      >
        {saving && <Spinner size={15} className="text-white" />}
        {isEdit ? "Save Changes" : "Create Scheme"}
      </button>
    </form>
  );
}
