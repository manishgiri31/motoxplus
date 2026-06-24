"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Pencil, Check, X, Layers } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface VariantImage {
  id: string;
  imageUrl: string;
  isPrimary: boolean;
  sortOrder: number;
}

interface Variant {
  id: string;
  label: string;
  sku: string | null;
  partNumber: string | null;
  color: string | null;
  vehicleModel: string | null;
  finish: string | null;
  size: string | null;
  extra: string | null;
  price: number;
  mrp: number | null;
  stock: number;
  moq: number | null;
  isActive: boolean;
  sortOrder: number;
  imageUrl: string | null;
  images: VariantImage[];
}

interface FormState {
  label: string;
  sku: string;
  partNumber: string;
  color: string;
  vehicleModel: string;
  finish: string;
  size: string;
  extra: string;
  price: string;
  mrp: string;
  stock: string;
  moq: string;
  imageUrl: string;
}

const empty: FormState = {
  label: "", sku: "", partNumber: "", color: "", vehicleModel: "", finish: "",
  size: "", extra: "", price: "", mrp: "", stock: "0", moq: "", imageUrl: "",
};

const ATTR_GROUPS = [
  { key: "color", label: "Color" },
  { key: "vehicleModel", label: "Vehicle Model" },
  { key: "finish", label: "Finish" },
  { key: "size", label: "Size" },
  { key: "extra", label: "Other" },
] as const;

export function ProductVariantManager({ productId }: { productId: string }) {
  const [variants, setVariants] = useState<Variant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(empty);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchVariants = async () => {
    const res = await fetch(`/api/admin/products/${productId}/variants`);
    if (res.ok) setVariants(await res.json());
    setLoading(false);
  };

  useEffect(() => { fetchVariants(); }, [productId]);

  const set = (k: keyof FormState, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const openAdd = () => { setForm(empty); setEditId(null); setShowForm(true); setError(""); };
  const openEdit = (v: Variant) => {
    setForm({
      label: v.label,
      sku: v.sku || "",
      partNumber: v.partNumber || "",
      color: v.color || "",
      vehicleModel: v.vehicleModel || "",
      finish: v.finish || "",
      size: v.size || "",
      extra: v.extra || "",
      price: String(v.price),
      mrp: v.mrp != null ? String(v.mrp) : "",
      stock: String(v.stock),
      moq: v.moq != null ? String(v.moq) : "",
      imageUrl: v.imageUrl || "",
    });
    setEditId(v.id);
    setShowForm(true);
    setError("");
  };

  const handleSave = async () => {
    if (!form.label.trim()) { setError("Label is required"); return; }
    if (!form.price || isNaN(parseFloat(form.price))) { setError("Valid price is required"); return; }
    setSaving(true);
    setError("");
    try {
      const url = editId
        ? `/api/admin/products/${productId}/variants/${editId}`
        : `/api/admin/products/${productId}/variants`;
      const res = await fetch(url, {
        method: editId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error || "Failed to save"); return; }
      await fetchVariants();
      setShowForm(false);
      setEditId(null);
    } catch { setError("Network error"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this variant?")) return;
    setDeletingId(id);
    await fetch(`/api/admin/products/${productId}/variants/${id}`, { method: "DELETE" });
    await fetchVariants();
    setDeletingId(null);
  };

  const toggleActive = async (v: Variant) => {
    await fetch(`/api/admin/products/${productId}/variants/${v.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !v.isActive }),
    });
    await fetchVariants();
  };

  const getThumb = (v: Variant) =>
    v.images.find((i) => i.isPrimary)?.imageUrl || v.images[0]?.imageUrl || v.imageUrl;

  return (
    <div className="mt-10 border-t border-[var(--border-color)] pt-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Layers size={18} className="text-red-400" />
          <div>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">Product Variants</h2>
            <p className="text-[var(--text-muted)] text-xs mt-0.5">
              Color, vehicle model, finish, size — each variant has its own price, SKU, MOQ, and images
            </p>
          </div>
        </div>
        {!showForm && (
          <button
            onClick={openAdd}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
          >
            <Plus size={14} />
            Add Variant
          </button>
        )}
      </div>

      {/* Add / Edit form */}
      {showForm && (
        <div className="glass border border-[var(--border-color)] rounded-xl p-5 mb-6">
          <h3 className="text-[var(--text-primary)] font-semibold text-sm mb-4">
            {editId ? "Edit Variant" : "New Variant"}
          </h3>
          {error && <p className="text-red-400 text-xs mb-3">{error}</p>}

          {/* Identity */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-[var(--text-muted)] text-xs font-semibold uppercase tracking-widest mb-1.5">
                Variant Label <span className="text-red-500">*</span>
              </label>
              <input
                value={form.label}
                onChange={(e) => set("label", e.target.value)}
                placeholder="e.g. Red / Matte Black / Hero Glamour"
                className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-[var(--text-primary)] text-sm focus:outline-none focus:border-red-600"
              />
            </div>
            <div>
              <label className="block text-[var(--text-muted)] text-xs font-semibold uppercase tracking-widest mb-1.5">SKU</label>
              <input
                value={form.sku}
                onChange={(e) => set("sku", e.target.value)}
                placeholder="Auto-generated if blank"
                className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-[var(--text-primary)] text-sm font-mono focus:outline-none focus:border-red-600"
              />
            </div>
            <div>
              <label className="block text-[var(--text-muted)] text-xs font-semibold uppercase tracking-widest mb-1.5">Part Number</label>
              <input
                value={form.partNumber}
                onChange={(e) => set("partNumber", e.target.value)}
                placeholder="e.g. MX-291"
                className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-[var(--text-primary)] text-sm font-mono focus:outline-none focus:border-red-600"
              />
            </div>
          </div>

          {/* Attributes */}
          <p className="text-[var(--text-muted)] text-xs font-semibold uppercase tracking-widest mb-2">Variant Attributes</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
            {ATTR_GROUPS.map(({ key, label }) => (
              <div key={key}>
                <label className="block text-[var(--text-muted)] text-xs mb-1.5">{label}</label>
                <input
                  value={form[key as keyof FormState]}
                  onChange={(e) => set(key as keyof FormState, e.target.value)}
                  placeholder={key === "color" ? "Red" : key === "vehicleModel" ? "Hero Glamour" : key === "finish" ? "Matte" : key === "size" ? "Large" : ""}
                  className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-[var(--text-primary)] text-sm focus:outline-none focus:border-red-600"
                />
              </div>
            ))}
          </div>

          {/* Pricing + Inventory */}
          <p className="text-[var(--text-muted)] text-xs font-semibold uppercase tracking-widest mb-2">Pricing & Inventory</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div>
              <label className="block text-[var(--text-muted)] text-xs mb-1.5">Price (excl. GST) <span className="text-red-500">*</span></label>
              <input type="number" min="0" step="0.01" value={form.price} onChange={(e) => set("price", e.target.value)}
                className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-[var(--text-primary)] text-sm focus:outline-none focus:border-red-600" />
            </div>
            <div>
              <label className="block text-[var(--text-muted)] text-xs mb-1.5">MRP</label>
              <input type="number" min="0" step="0.01" value={form.mrp} onChange={(e) => set("mrp", e.target.value)}
                className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-[var(--text-primary)] text-sm focus:outline-none focus:border-red-600" />
            </div>
            <div>
              <label className="block text-[var(--text-muted)] text-xs mb-1.5">Stock</label>
              <input type="number" min="0" value={form.stock} onChange={(e) => set("stock", e.target.value)}
                className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-[var(--text-primary)] text-sm focus:outline-none focus:border-red-600" />
            </div>
            <div>
              <label className="block text-[var(--text-muted)] text-xs mb-1.5">MOQ <span className="text-[var(--text-muted)] font-normal">(blank = product default)</span></label>
              <input type="number" min="1" step="1" value={form.moq} onChange={(e) => set("moq", e.target.value)}
                placeholder="Product default"
                className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-[var(--text-primary)] text-sm focus:outline-none focus:border-red-600" />
            </div>
          </div>

          {/* Image */}
          <div className="mb-5">
            <label className="block text-[var(--text-muted)] text-xs font-semibold uppercase tracking-widest mb-1.5">Primary Image URL</label>
            <input
              value={form.imageUrl}
              onChange={(e) => set("imageUrl", e.target.value)}
              placeholder="https://..."
              className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-[var(--text-primary)] text-sm focus:outline-none focus:border-red-600"
            />
          </div>

          <div className="flex gap-3">
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors">
              <Check size={14} />
              {saving ? "Saving..." : editId ? "Update" : "Add Variant"}
            </button>
            <button onClick={() => { setShowForm(false); setEditId(null); }}
              className="flex items-center gap-2 glass border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-primary)] text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors">
              <X size={14} />
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Variants table */}
      {loading ? (
        <p className="text-[var(--text-muted)] text-sm">Loading variants...</p>
      ) : variants.length === 0 ? (
        <div className="text-center py-10 glass border border-dashed border-[var(--border-color)] rounded-xl">
          <Layers size={32} className="text-gray-700 mx-auto mb-3" />
          <p className="text-[var(--text-muted)] text-sm mb-1">No variants yet.</p>
          <p className="text-[var(--text-muted)] text-xs">Add variants for different colors, vehicle models, finishes, or sizes.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {variants.map((v) => {
            const thumb = getThumb(v);
            const isExpanded = expandedId === v.id;
            const attrs = [
              v.color && `Color: ${v.color}`,
              v.vehicleModel && `Model: ${v.vehicleModel}`,
              v.finish && `Finish: ${v.finish}`,
              v.size && `Size: ${v.size}`,
              v.extra,
            ].filter(Boolean);

            return (
              <div key={v.id} className="glass border border-[var(--border-color)] rounded-xl overflow-hidden">
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[var(--bg-card-hover)] transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : v.id)}
                >
                  {/* Thumb */}
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-zinc-800 to-black flex-shrink-0 overflow-hidden">
                    {thumb ? (
                      <img src={thumb} alt={v.label} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-red-900/30 font-black text-xs">◈</div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[var(--text-primary)] font-bold text-sm">{v.label}</span>
                      {v.partNumber && <span className="text-[var(--text-muted)] text-[10px] font-mono">{v.partNumber}</span>}
                      {attrs.slice(0, 3).map((a, i) => (
                        <span key={i} className="bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-muted)] text-[10px] px-1.5 py-0.5 rounded-full">{a}</span>
                      ))}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs">
                      <span className="text-red-400 font-bold">{formatCurrency(v.price)}</span>
                      {v.mrp && <span className="text-gray-500 line-through">{formatCurrency(v.mrp)}</span>}
                      <span className="text-[var(--text-muted)]">Stock: {v.stock}</span>
                      {v.moq && <span className="text-[var(--text-muted)]">MOQ: {v.moq}</span>}
                      {v.sku && <span className="text-[var(--text-muted)] font-mono">{v.sku}</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleActive(v); }}
                      className={`w-8 h-5 rounded-full transition-colors relative ${v.isActive ? "bg-green-600" : "bg-gray-700"}`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${v.isActive ? "left-3.5" : "left-0.5"}`} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); openEdit(v); }}
                      className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-1">
                      <Pencil size={13} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(v.id); }}
                      disabled={deletingId === v.id}
                      className="text-gray-600 hover:text-red-500 transition-colors p-1 disabled:opacity-40">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-[var(--border-color)] px-4 py-3 bg-[var(--bg-card)]/50">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      {v.sku && <div><span className="text-[var(--text-muted)] uppercase tracking-wider">SKU</span><div className="font-mono text-[var(--text-primary)] mt-0.5">{v.sku}</div></div>}
                      {v.partNumber && <div><span className="text-[var(--text-muted)] uppercase tracking-wider">Part No.</span><div className="font-mono text-[var(--text-primary)] mt-0.5">{v.partNumber}</div></div>}
                      {v.moq && <div><span className="text-[var(--text-muted)] uppercase tracking-wider">MOQ</span><div className="text-[var(--text-primary)] mt-0.5">{v.moq} pcs</div></div>}
                      {v.color && <div><span className="text-[var(--text-muted)] uppercase tracking-wider">Color</span><div className="text-[var(--text-primary)] mt-0.5 flex items-center gap-1.5"><span className="w-3 h-3 rounded-full border border-white/20" style={{ background: v.color.toLowerCase() }} />{v.color}</div></div>}
                      {v.vehicleModel && <div><span className="text-[var(--text-muted)] uppercase tracking-wider">Model</span><div className="text-[var(--text-primary)] mt-0.5">{v.vehicleModel}</div></div>}
                      {v.finish && <div><span className="text-[var(--text-muted)] uppercase tracking-wider">Finish</span><div className="text-[var(--text-primary)] mt-0.5">{v.finish}</div></div>}
                      {v.size && <div><span className="text-[var(--text-muted)] uppercase tracking-wider">Size</span><div className="text-[var(--text-primary)] mt-0.5">{v.size}</div></div>}
                      {v.extra && <div><span className="text-[var(--text-muted)] uppercase tracking-wider">Extra</span><div className="text-[var(--text-primary)] mt-0.5">{v.extra}</div></div>}
                    </div>
                    {v.images.length > 0 && (
                      <div className="flex gap-2 mt-3">
                        {v.images.map((img) => (
                          <img key={img.id} src={img.imageUrl} alt="" className={`w-14 h-14 rounded-lg object-cover border ${img.isPrimary ? "border-red-600" : "border-[var(--border-color)]"}`} />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
