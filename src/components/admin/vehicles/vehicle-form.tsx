"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";

const CATEGORIES = ["MOTORCYCLE", "SCOOTER", "ELECTRIC", "COMMERCIAL"];

interface ManufacturerOption {
  id: string;
  name: string;
}

interface VehicleInitial {
  id: string;
  name: string;
  slug: string;
  category: string;
  manufacturerId: string;
  engineCc: number | null;
  launchYear: number | null;
  yearFrom: number | null;
  yearTo: number | null;
  heroImage: string | null;
  power: string | null;
  torque: string | null;
  mileage: string | null;
  weight: string | null;
  fuelTank: string | null;
  modelUrl: string | null;
  badgeText: string | null;
  searchAliases: string[];
  ocrKeywords: string[];
  aiLabels: string[];
  sortOrder: number;
  isActive: boolean;
}

function toField(v: number | string | null | undefined) {
  return v == null ? "" : String(v);
}

export function VehicleForm({
  manufacturers,
  vehicle,
}: {
  manufacturers: ManufacturerOption[];
  vehicle?: VehicleInitial;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: vehicle?.name ?? "",
    slug: vehicle?.slug ?? "",
    category: vehicle?.category ?? "MOTORCYCLE",
    manufacturerId: vehicle?.manufacturerId ?? manufacturers[0]?.id ?? "",
    engineCc: toField(vehicle?.engineCc),
    launchYear: toField(vehicle?.launchYear),
    yearFrom: toField(vehicle?.yearFrom),
    yearTo: toField(vehicle?.yearTo),
    heroImage: vehicle?.heroImage ?? "",
    power: vehicle?.power ?? "",
    torque: vehicle?.torque ?? "",
    mileage: vehicle?.mileage ?? "",
    weight: vehicle?.weight ?? "",
    fuelTank: vehicle?.fuelTank ?? "",
    modelUrl: vehicle?.modelUrl ?? "",
    badgeText: vehicle?.badgeText ?? "",
    searchAliases: (vehicle?.searchAliases ?? []).join(", "),
    ocrKeywords: (vehicle?.ocrKeywords ?? []).join(", "),
    aiLabels: (vehicle?.aiLabels ?? []).join(", "),
    sortOrder: toField(vehicle?.sortOrder ?? 0),
    isActive: vehicle?.isActive ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (k: keyof typeof form, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim() || !form.slug.trim() || !form.manufacturerId) {
      setError("Name, slug and manufacturer are required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const url = vehicle ? `/api/admin/vehicles/${vehicle.id}` : "/api/admin/vehicles";
      const res = await fetch(url, {
        method: vehicle ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "Failed to save");
        return;
      }
      const saved = await res.json();
      if (!vehicle) {
        router.push(`/admin/vehicles/${saved.id}/edit`);
      } else {
        router.refresh();
      }
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="glass border border-[var(--border-color)] rounded-2xl p-5 space-y-5">
      {error && <p className="text-red-400 text-xs">{error}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-[var(--text-muted)] text-xs font-semibold uppercase tracking-widest mb-1.5">
            Name <span className="text-red-500">*</span>
          </label>
          <input value={form.name} onChange={(e) => set("name", e.target.value)} className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-red-600" />
        </div>
        <div>
          <label className="block text-[var(--text-muted)] text-xs font-semibold uppercase tracking-widest mb-1.5">
            Slug <span className="text-red-500">*</span>
          </label>
          <input value={form.slug} onChange={(e) => set("slug", e.target.value)} className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-sm font-mono text-[var(--text-primary)] focus:outline-none focus:border-red-600" />
        </div>
        <div>
          <label className="block text-[var(--text-muted)] text-xs font-semibold uppercase tracking-widest mb-1.5">Category</label>
          <select value={form.category} onChange={(e) => set("category", e.target.value)} className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-red-600">
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[var(--text-muted)] text-xs font-semibold uppercase tracking-widest mb-1.5">Manufacturer</label>
          <select value={form.manufacturerId} onChange={(e) => set("manufacturerId", e.target.value)} className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-red-600">
            {manufacturers.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
      </div>

      <p className="text-[var(--text-muted)] text-xs font-semibold uppercase tracking-widest">Specs</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {([
          ["engineCc", "Engine (cc)"],
          ["launchYear", "Launch Year"],
          ["yearFrom", "Year From"],
          ["yearTo", "Year To"],
        ] as const).map(([k, label]) => (
          <div key={k}>
            <label className="block text-[var(--text-muted)] text-xs mb-1.5">{label}</label>
            <input type="number" value={form[k]} onChange={(e) => set(k, e.target.value)} className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-red-600" />
          </div>
        ))}
        {([
          ["power", "Power"],
          ["torque", "Torque"],
          ["mileage", "Mileage"],
          ["weight", "Weight"],
          ["fuelTank", "Fuel Tank"],
        ] as const).map(([k, label]) => (
          <div key={k}>
            <label className="block text-[var(--text-muted)] text-xs mb-1.5">{label}</label>
            <input value={form[k]} onChange={(e) => set(k, e.target.value)} className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-red-600" />
          </div>
        ))}
      </div>

      <p className="text-[var(--text-muted)] text-xs font-semibold uppercase tracking-widest">Media & AI</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-[var(--text-muted)] text-xs mb-1.5">Hero Image URL</label>
          <input value={form.heroImage} onChange={(e) => set("heroImage", e.target.value)} className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-red-600" />
        </div>
        <div>
          <label className="block text-[var(--text-muted)] text-xs mb-1.5">Default GLB Model URL</label>
          <input value={form.modelUrl} onChange={(e) => set("modelUrl", e.target.value)} className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-red-600" />
        </div>
        <div>
          <label className="block text-[var(--text-muted)] text-xs mb-1.5">Badge Text (OCR)</label>
          <input value={form.badgeText} onChange={(e) => set("badgeText", e.target.value)} placeholder="SPLENDOR" className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-red-600" />
        </div>
        <div>
          <label className="block text-[var(--text-muted)] text-xs mb-1.5">Sort Order</label>
          <input type="number" value={form.sortOrder} onChange={(e) => set("sortOrder", e.target.value)} className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-red-600" />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-[var(--text-muted)] text-xs mb-1.5">Search Aliases (comma-separated)</label>
          <input value={form.searchAliases} onChange={(e) => set("searchAliases", e.target.value)} placeholder="Hero Splendor, Splendor NXG" className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-red-600" />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-[var(--text-muted)] text-xs mb-1.5">OCR Keywords (comma-separated)</label>
          <input value={form.ocrKeywords} onChange={(e) => set("ocrKeywords", e.target.value)} placeholder="SPLENDOR, HERO SPLENDOR" className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-red-600" />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-[var(--text-muted)] text-xs mb-1.5">AI Detection Labels (comma-separated)</label>
          <input value={form.aiLabels} onChange={(e) => set("aiLabels", e.target.value)} placeholder="hero-splendor, commuter-motorcycle" className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-red-600" />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => set("isActive", !form.isActive)}
          className={`w-9 h-5 rounded-full transition-colors relative ${form.isActive ? "bg-green-600" : "bg-gray-700"}`}
        >
          <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${form.isActive ? "left-4" : "left-0.5"}`} />
        </button>
        <span className="text-[var(--text-muted)] text-xs font-semibold uppercase tracking-widest">Active</span>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-colors"
      >
        <Check size={14} />
        {saving ? "Saving…" : vehicle ? "Save Changes" : "Create Vehicle"}
      </button>
    </div>
  );
}
