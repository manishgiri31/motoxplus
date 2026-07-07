"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Pencil, Check, X, GitBranch } from "lucide-react";

interface VehicleOption {
  id: string;
  name: string;
  category: string;
  manufacturer: { name: string };
  generations: { id: string; name: string }[];
  variants: { id: string; name: string; generationId: string | null }[];
}
interface SectionOption {
  id: string;
  name: string;
}
interface CompatibilityRow {
  id: string;
  vehicleId: string | null;
  generationId: string | null;
  variantId: string | null;
  sectionId: string | null;
  yearFrom: number | null;
  yearTo: number | null;
  emissionStandard: string | null;
  confidence: string;
  source: string;
  position: string | null;
  fitmentNote: string | null;
  isActive: boolean;
  vehicle: { id: string; name: string } | null;
  generation: { id: string; name: string } | null;
  variant: { id: string; name: string } | null;
  section: { id: string; name: string } | null;
}

const EMISSION_OPTIONS = ["BS3", "BS4", "BS6", "BS6_PHASE2"];
const CONFIDENCE_OPTIONS = ["VERIFIED", "LIKELY", "UNVERIFIED", "INCOMPATIBLE"];
const SOURCE_OPTIONS = ["MANUAL", "OEM_CATALOG", "IMPORTED", "LEGACY_STRING", "AI_INFERRED"];

const emptyForm = {
  vehicleId: "",
  generationId: "",
  variantId: "",
  sectionId: "",
  yearFrom: "",
  yearTo: "",
  emissionStandard: "",
  confidence: "LIKELY",
  source: "MANUAL",
  position: "",
  fitmentNote: "",
};

export function ProductCompatibilityManager({ productId }: { productId: string }) {
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [sections, setSections] = useState<SectionOption[]>([]);
  const [rows, setRows] = useState<CompatibilityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const base = `/api/admin/products/${productId}/compatibility`;

  const load = async () => {
    setLoading(true);
    const [optionsRes, rowsRes] = await Promise.all([fetch("/api/admin/vehicles/options"), fetch(base)]);
    if (optionsRes.ok) {
      const d = await optionsRes.json();
      setVehicles(d.vehicles);
      setSections(d.sections);
    }
    if (rowsRes.ok) setRows(await rowsRes.json());
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const selectedVehicle = useMemo(() => vehicles.find((v) => v.id === form.vehicleId), [vehicles, form.vehicleId]);
  const availableVariants = useMemo(
    () =>
      selectedVehicle?.variants.filter((v) => !form.generationId || v.generationId === form.generationId) ?? [],
    [selectedVehicle, form.generationId]
  );

  const set = (k: keyof typeof emptyForm, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const openAdd = () => {
    setForm(emptyForm);
    setEditId(null);
    setShowForm(true);
    setError("");
  };

  const openEdit = (r: CompatibilityRow) => {
    setForm({
      vehicleId: r.vehicleId || "",
      generationId: r.generationId || "",
      variantId: r.variantId || "",
      sectionId: r.sectionId || "",
      yearFrom: r.yearFrom != null ? String(r.yearFrom) : "",
      yearTo: r.yearTo != null ? String(r.yearTo) : "",
      emissionStandard: r.emissionStandard || "",
      confidence: r.confidence,
      source: r.source,
      position: r.position || "",
      fitmentNote: r.fitmentNote || "",
    });
    setEditId(r.id);
    setShowForm(true);
    setError("");
  };

  const handleSave = async () => {
    if (!form.vehicleId) {
      setError("Select a vehicle");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const url = editId ? `${base}/${editId}` : base;
      const res = await fetch(url, {
        method: editId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "Failed to save");
        return;
      }
      await load();
      setShowForm(false);
      setEditId(null);
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this fitment?")) return;
    setDeletingId(id);
    await fetch(`${base}/${id}`, { method: "DELETE" });
    await load();
    setDeletingId(null);
  };

  return (
    <div className="mt-10 border-t border-[var(--border-color)] pt-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <GitBranch size={18} className="text-red-400" />
          <div>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">Vehicle Fitment</h2>
            <p className="text-[var(--text-muted)] text-xs mt-0.5">
              Map this product to exact manufacturer → model → generation → variant → year → bike section, with a confidence grade.
            </p>
          </div>
        </div>
        {!showForm && (
          <button
            onClick={openAdd}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
          >
            <Plus size={14} /> Add Fitment
          </button>
        )}
      </div>

      {showForm && (
        <div className="glass border border-[var(--border-color)] rounded-xl p-5 mb-6">
          {error && <p className="text-red-400 text-xs mb-3">{error}</p>}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-[var(--text-muted)] text-xs font-semibold uppercase tracking-widest mb-1.5">
                Vehicle <span className="text-red-500">*</span>
              </label>
              <select
                value={form.vehicleId}
                onChange={(e) => setForm((f) => ({ ...f, vehicleId: e.target.value, generationId: "", variantId: "" }))}
                className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-red-600"
              >
                <option value="">Select vehicle…</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.manufacturer.name} {v.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[var(--text-muted)] text-xs font-semibold uppercase tracking-widest mb-1.5">Section</label>
              <select
                value={form.sectionId}
                onChange={(e) => set("sectionId", e.target.value)}
                className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-red-600"
              >
                <option value="">No section</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[var(--text-muted)] text-xs mb-1.5">Generation</label>
              <select
                value={form.generationId}
                onChange={(e) => setForm((f) => ({ ...f, generationId: e.target.value, variantId: "" }))}
                disabled={!selectedVehicle}
                className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-red-600 disabled:opacity-50"
              >
                <option value="">Any generation</option>
                {selectedVehicle?.generations.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[var(--text-muted)] text-xs mb-1.5">Variant</label>
              <select
                value={form.variantId}
                onChange={(e) => set("variantId", e.target.value)}
                disabled={!selectedVehicle}
                className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-red-600 disabled:opacity-50"
              >
                <option value="">Any variant</option>
                {availableVariants.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div>
              <label className="block text-[var(--text-muted)] text-xs mb-1.5">Year From</label>
              <input type="number" value={form.yearFrom} onChange={(e) => set("yearFrom", e.target.value)} className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-red-600" />
            </div>
            <div>
              <label className="block text-[var(--text-muted)] text-xs mb-1.5">Year To</label>
              <input type="number" value={form.yearTo} onChange={(e) => set("yearTo", e.target.value)} className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-red-600" />
            </div>
            <div>
              <label className="block text-[var(--text-muted)] text-xs mb-1.5">Emission</label>
              <select value={form.emissionStandard} onChange={(e) => set("emissionStandard", e.target.value)} className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-2 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-red-600">
                <option value="">Any</option>
                {EMISSION_OPTIONS.map((o) => (
                  <option key={o} value={o}>{o.replace("_", " ")}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[var(--text-muted)] text-xs mb-1.5">Position</label>
              <input value={form.position} onChange={(e) => set("position", e.target.value)} placeholder="Front / Rear" className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-red-600" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-[var(--text-muted)] text-xs mb-1.5">Confidence</label>
              <select value={form.confidence} onChange={(e) => set("confidence", e.target.value)} className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-2 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-red-600">
                {CONFIDENCE_OPTIONS.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[var(--text-muted)] text-xs mb-1.5">Source</label>
              <select value={form.source} onChange={(e) => set("source", e.target.value)} className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-2 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-red-600">
                {SOURCE_OPTIONS.map((o) => (
                  <option key={o} value={o}>{o.replace("_", " ")}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mb-5">
            <label className="block text-[var(--text-muted)] text-xs mb-1.5">Fitment Note</label>
            <textarea value={form.fitmentNote} onChange={(e) => set("fitmentNote", e.target.value)} rows={2} className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-red-600" />
          </div>

          <div className="flex gap-3">
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors">
              <Check size={14} /> {saving ? "Saving..." : editId ? "Update" : "Add Fitment"}
            </button>
            <button onClick={() => { setShowForm(false); setEditId(null); }} className="flex items-center gap-2 glass border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-primary)] text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors">
              <X size={14} /> Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-[var(--text-muted)] text-sm">Loading fitments...</p>
      ) : rows.length === 0 ? (
        <div className="text-center py-10 glass border border-dashed border-[var(--border-color)] rounded-xl">
          <GitBranch size={32} className="text-gray-700 mx-auto mb-3" />
          <p className="text-[var(--text-muted)] text-sm">No fitments mapped yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="glass border border-[var(--border-color)] rounded-xl px-4 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[var(--text-primary)] font-bold text-sm">{r.vehicle?.name ?? "Unknown vehicle"}</span>
                  {r.generation && <span className="bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-muted)] text-[10px] px-1.5 py-0.5 rounded-full">{r.generation.name}</span>}
                  {r.variant && <span className="bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-muted)] text-[10px] px-1.5 py-0.5 rounded-full">{r.variant.name}</span>}
                  {r.section && <span className="bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-muted)] text-[10px] px-1.5 py-0.5 rounded-full">{r.section.name}</span>}
                  {r.emissionStandard && <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[10px] px-1.5 py-0.5 rounded-full">{r.emissionStandard.replace("_", " ")}</span>}
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-[var(--text-muted)]">
                  <span className={`font-semibold ${r.confidence === "VERIFIED" ? "text-emerald-500" : r.confidence === "LIKELY" ? "text-amber-500" : r.confidence === "INCOMPATIBLE" ? "text-red-500" : ""}`}>
                    {r.confidence}
                  </span>
                  {(r.yearFrom || r.yearTo) && <span>{r.yearFrom ?? "—"}–{r.yearTo ?? "present"}</span>}
                  {r.position && <span>{r.position}</span>}
                  <span>{r.source}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => openEdit(r)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1"><Pencil size={13} /></button>
                <button onClick={() => handleDelete(r.id)} disabled={deletingId === r.id} className="text-gray-600 hover:text-red-500 p-1 disabled:opacity-40"><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
