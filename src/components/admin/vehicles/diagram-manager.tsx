"use client";

import { useEffect, useState, type MouseEvent } from "react";
import { Plus, Trash2, Pencil, Check, X, MapPin } from "lucide-react";

interface Section {
  id: string;
  name: string;
}
interface Hotspot {
  id: string;
  x: number;
  y: number;
  label: string;
  calloutNumber: number | null;
  sectionId: string | null;
  productId: string | null;
  sortOrder: number;
}
interface Diagram {
  id: string;
  name: string;
  imageUrl: string;
  sectionId: string | null;
  isActive: boolean;
  hotspots: Hotspot[];
}
interface ProductHit {
  id: string;
  name: string;
  partNumber: string;
}

const emptyDiagramForm = { name: "", imageUrl: "", sectionId: "" };

function HotspotEditor({
  vehicleId,
  diagram,
  sections,
  onChanged,
}: {
  vehicleId: string;
  diagram: Diagram;
  sections: Section[];
  onChanged: () => void;
}) {
  const base = `/api/admin/vehicles/${vehicleId}/diagrams/${diagram.id}/hotspots`;
  const [pending, setPending] = useState<{ x: number; y: number } | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ label: "", calloutNumber: "", sectionId: "", productId: "", productQuery: "" });
  const [productHits, setProductHits] = useState<ProductHit[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (form.productQuery.trim().length < 2) {
      setProductHits([]);
      return;
    }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/products?search=${encodeURIComponent(form.productQuery)}&pageSize=8&adminAll=1`);
      if (res.ok) {
        const d = await res.json();
        setProductHits(d.products.map((p: ProductHit) => ({ id: p.id, name: p.name, partNumber: p.partNumber })));
      }
    }, 300);
    return () => clearTimeout(t);
  }, [form.productQuery]);

  const openAddAt = (x: number, y: number) => {
    setPending({ x, y });
    setEditId(null);
    setForm({ label: "", calloutNumber: "", sectionId: "", productId: "", productQuery: "" });
    setError("");
  };

  const openEdit = (h: Hotspot) => {
    setPending({ x: h.x, y: h.y });
    setEditId(h.id);
    setForm({
      label: h.label,
      calloutNumber: h.calloutNumber != null ? String(h.calloutNumber) : "",
      sectionId: h.sectionId || "",
      productId: h.productId || "",
      productQuery: "",
    });
    setError("");
  };

  const handleImageClick = (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    openAddAt(Math.round(x * 10) / 10, Math.round(y * 10) / 10);
  };

  const handleSave = async () => {
    if (!pending || !form.label.trim()) {
      setError("Click the image to place the hotspot, and enter a label.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = {
        x: pending.x,
        y: pending.y,
        label: form.label.trim(),
        calloutNumber: form.calloutNumber || null,
        sectionId: form.sectionId || null,
        productId: form.productId || null,
      };
      const url = editId ? `${base}/${editId}` : base;
      const res = await fetch(url, {
        method: editId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "Failed to save");
        return;
      }
      setPending(null);
      setEditId(null);
      onChanged();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this hotspot?")) return;
    await fetch(`${base}/${id}`, { method: "DELETE" });
    onChanged();
  };

  return (
    <div className="mt-4 border-t border-[var(--border-color)] pt-4">
      <p className="text-[var(--text-muted)] text-xs mb-3">Click anywhere on the diagram to place a new hotspot.</p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div
          onClick={handleImageClick}
          className="relative w-full rounded-xl overflow-hidden border border-[var(--border-color)] bg-[var(--bg-secondary)] cursor-crosshair"
          style={{ paddingTop: "60%" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={diagram.imageUrl} alt={diagram.name} className="absolute inset-0 w-full h-full object-contain pointer-events-none" />
          {diagram.hotspots.map((h) => (
            <button
              key={h.id}
              onClick={(e) => {
                e.stopPropagation();
                openEdit(h);
              }}
              className="absolute -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center border-2 border-white/80 hover:scale-110 transition-transform"
              style={{ left: `${h.x}%`, top: `${h.y}%` }}
            >
              {h.calloutNumber ?? "•"}
            </button>
          ))}
          {pending && !editId && (
            <span
              className="absolute -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-amber-500 border-2 border-white/80 pointer-events-none"
              style={{ left: `${pending.x}%`, top: `${pending.y}%` }}
            />
          )}
        </div>

        <div>
          {pending ? (
            <div className="border border-[var(--border-color)] rounded-xl p-4 space-y-3">
              {error && <p className="text-red-400 text-xs">{error}</p>}
              <p className="text-[var(--text-muted)] text-[10px] uppercase tracking-widest font-semibold">
                Position: {pending.x.toFixed(1)}%, {pending.y.toFixed(1)}%
              </p>
              <input
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="Label (e.g. Front Mudguard)"
                className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-red-600"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  value={form.calloutNumber}
                  onChange={(e) => setForm((f) => ({ ...f, calloutNumber: e.target.value }))}
                  placeholder="Callout #"
                  className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-red-600"
                />
                <select
                  value={form.sectionId}
                  onChange={(e) => setForm((f) => ({ ...f, sectionId: e.target.value }))}
                  className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg px-2 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-red-600"
                >
                  <option value="">No section</option>
                  {sections.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <input
                  value={form.productId ? form.productQuery || "Product linked — type to change" : form.productQuery}
                  onChange={(e) => setForm((f) => ({ ...f, productQuery: e.target.value, productId: "" }))}
                  placeholder="Search product to link (optional)"
                  className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-red-600"
                />
                {productHits.length > 0 && (
                  <div className="mt-1 border border-[var(--border-color)] rounded-lg overflow-hidden max-h-32 overflow-y-auto">
                    {productHits.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          setForm((f) => ({ ...f, productId: p.id, productQuery: p.name }));
                          setProductHits([]);
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]"
                      >
                        {p.name} <span className="text-[var(--text-muted)] font-mono">{p.partNumber}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-lg">
                  <Check size={13} /> {saving ? "Saving…" : editId ? "Update Hotspot" : "Add Hotspot"}
                </button>
                <button onClick={() => setPending(null)} className="flex items-center gap-1.5 border border-[var(--border-color)] text-[var(--text-muted)] text-xs font-semibold px-4 py-2 rounded-lg">
                  <X size={13} /> Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className="text-[var(--text-muted)] text-xs">No hotspot selected.</p>
          )}

          <div className="mt-4 space-y-1.5">
            {diagram.hotspots.map((h) => (
              <div key={h.id} className="flex items-center justify-between text-xs border border-[var(--border-color)] rounded-lg px-3 py-2">
                <span className="text-[var(--text-primary)] font-semibold">{h.calloutNumber ?? "•"} {h.label}</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => openEdit(h)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"><Pencil size={12} /></button>
                  <button onClick={() => handleDelete(h.id)} className="text-gray-600 hover:text-red-500"><Trash2 size={12} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function DiagramManager({ vehicleId, sections }: { vehicleId: string; sections: Section[] }) {
  const base = `/api/admin/vehicles/${vehicleId}/diagrams`;
  const [diagrams, setDiagrams] = useState<Diagram[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyDiagramForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const res = await fetch(base);
    if (res.ok) setDiagrams(await res.json());
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleId]);

  const openAdd = () => {
    setForm(emptyDiagramForm);
    setEditId(null);
    setShowForm(true);
    setError("");
  };
  const openEdit = (d: Diagram) => {
    setForm({ name: d.name, imageUrl: d.imageUrl, sectionId: d.sectionId || "" });
    setEditId(d.id);
    setShowForm(true);
    setError("");
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.imageUrl.trim()) {
      setError("Name and image URL are required");
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
    if (!confirm("Delete this diagram and all its hotspots?")) return;
    await fetch(`${base}/${id}`, { method: "DELETE" });
    if (expandedId === id) setExpandedId(null);
    await load();
  };

  return (
    <div className="glass border border-[var(--border-color)] rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-[var(--text-primary)] font-bold text-sm">Interactive Parts Diagrams</h3>
          <p className="text-[var(--text-muted)] text-xs mt-0.5">Upload an exploded-view or line-art image, then click on it to place clickable part hotspots.</p>
        </div>
        {!showForm && (
          <button onClick={openAdd} className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg">
            <Plus size={13} /> Add Diagram
          </button>
        )}
      </div>

      {showForm && (
        <div className="border border-[var(--border-color)] rounded-xl p-4 mb-4 bg-[var(--bg-card)]/50">
          {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Diagram name (e.g. Front End Assembly)" className="bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-red-600 sm:col-span-2" />
            <select value={form.sectionId} onChange={(e) => setForm((f) => ({ ...f, sectionId: e.target.value }))} className="bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg px-2 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-red-600">
              <option value="">No section</option>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <input value={form.imageUrl} onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))} placeholder="Diagram image URL" className="bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-red-600 sm:col-span-3" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-lg">
              <Check size={13} /> {saving ? "Saving…" : editId ? "Update" : "Add"}
            </button>
            <button onClick={() => setShowForm(false)} className="flex items-center gap-1.5 border border-[var(--border-color)] text-[var(--text-muted)] text-xs font-semibold px-4 py-2 rounded-lg">
              <X size={13} /> Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-[var(--text-muted)] text-xs">Loading…</p>
      ) : diagrams.length === 0 ? (
        <p className="text-[var(--text-muted)] text-xs py-4 text-center">No diagrams yet.</p>
      ) : (
        <div className="space-y-3">
          {diagrams.map((d) => (
            <div key={d.id} className="border border-[var(--border-color)] rounded-xl p-3">
              <div className="flex items-center justify-between">
                <button onClick={() => setExpandedId(expandedId === d.id ? null : d.id)} className="flex items-center gap-2 text-left flex-1">
                  <MapPin size={14} className="text-red-400" />
                  <span className="text-[var(--text-primary)] font-semibold text-sm">{d.name}</span>
                  <span className="text-[var(--text-muted)] text-xs">({d.hotspots.length} hotspots)</span>
                </button>
                <div className="flex items-center gap-2">
                  <button onClick={() => openEdit(d)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1"><Pencil size={12} /></button>
                  <button onClick={() => handleDelete(d.id)} className="text-gray-600 hover:text-red-500 p-1"><Trash2 size={12} /></button>
                </div>
              </div>
              {expandedId === d.id && (
                <HotspotEditor vehicleId={vehicleId} diagram={d} sections={sections} onChanged={load} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
