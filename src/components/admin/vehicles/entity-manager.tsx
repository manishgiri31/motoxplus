"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Pencil, Check, X } from "lucide-react";

export interface EntityFieldOption {
  value: string;
  label: string;
}

export interface EntityField {
  key: string;
  label: string;
  type: "text" | "number" | "textarea" | "select" | "checkbox" | "color";
  options?: EntityFieldOption[];
  required?: boolean;
  placeholder?: string;
  span?: 1 | 2 | 3 | 4;
}

export interface EntityColumn {
  key: string;
  label: string;
  render?: (row: Record<string, any>) => React.ReactNode;
}

/**
 * Config-driven CRUD list+form, reused across the simpler flat-field vehicle
 * admin entities (part sections, manufacturers, OEM colors, generations,
 * gallery images, VIN patterns, 3D models, 360 spins) so each only needs a
 * field/column config instead of a bespoke component.
 */
export function EntityManager({
  title,
  description,
  apiBase,
  fields,
  columns,
  emptyMessage = "Nothing here yet.",
  toFormValues,
  toPayload,
  onChanged,
}: {
  title: string;
  description?: string;
  apiBase: string;
  fields: EntityField[];
  columns: EntityColumn[];
  emptyMessage?: string;
  toFormValues?: (row: Record<string, any>) => Record<string, string>;
  toPayload?: (form: Record<string, string>) => Record<string, unknown>;
  /** Fires after a successful save or delete — lets a parent refresh sibling lookups (e.g. a generation list feeding a variant picker). */
  onChanged?: () => void;
}) {
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const emptyForm = () =>
    Object.fromEntries(fields.map((f) => [f.key, f.type === "checkbox" ? "false" : ""]));

  const load = async () => {
    setLoading(true);
    const res = await fetch(apiBase);
    if (res.ok) setRows(await res.json());
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase]);

  const openAdd = () => {
    setForm(emptyForm());
    setEditId(null);
    setShowForm(true);
    setError("");
  };

  const openEdit = (row: Record<string, any>) => {
    const base = toFormValues
      ? toFormValues(row)
      : Object.fromEntries(fields.map((f) => [f.key, row[f.key] == null ? "" : String(row[f.key])]));
    setForm(base);
    setEditId(row.id);
    setShowForm(true);
    setError("");
  };

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    for (const f of fields) {
      if (f.required && !form[f.key]?.trim()) {
        setError(`${f.label} is required`);
        return;
      }
    }
    setSaving(true);
    setError("");
    try {
      const payload = toPayload ? toPayload(form) : form;
      const url = editId ? `${apiBase}/${editId}` : apiBase;
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
      await load();
      setShowForm(false);
      setEditId(null);
      onChanged?.();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this item?")) return;
    setDeletingId(id);
    await fetch(`${apiBase}/${id}`, { method: "DELETE" });
    await load();
    setDeletingId(null);
    onChanged?.();
  };

  return (
    <div className="glass border border-[var(--border-color)] rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-[var(--text-primary)] font-bold text-sm">{title}</h3>
          {description && <p className="text-[var(--text-muted)] text-xs mt-0.5">{description}</p>}
        </div>
        {!showForm && (
          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
          >
            <Plus size={13} />
            Add
          </button>
        )}
      </div>

      {showForm && (
        <div className="border border-[var(--border-color)] rounded-xl p-4 mb-4 bg-[var(--bg-card)]/50">
          {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {fields.map((f) => (
              <div key={f.key} className={f.span === 2 ? "col-span-2" : f.span === 4 ? "col-span-2 sm:col-span-4" : f.span === 3 ? "col-span-2 sm:col-span-3" : ""}>
                <label className="block text-[var(--text-muted)] text-[10px] uppercase tracking-widest font-semibold mb-1">
                  {f.label} {f.required && <span className="text-red-500">*</span>}
                </label>
                {f.type === "select" ? (
                  <select
                    value={form[f.key] ?? ""}
                    onChange={(e) => set(f.key, e.target.value)}
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg px-2.5 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-red-600"
                  >
                    <option value="">—</option>
                    {f.options?.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : f.type === "textarea" ? (
                  <textarea
                    value={form[f.key] ?? ""}
                    onChange={(e) => set(f.key, e.target.value)}
                    placeholder={f.placeholder}
                    rows={3}
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg px-2.5 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-red-600"
                  />
                ) : f.type === "checkbox" ? (
                  <button
                    type="button"
                    onClick={() => set(f.key, form[f.key] === "true" ? "false" : "true")}
                    className={`w-9 h-5 rounded-full transition-colors relative ${form[f.key] === "true" ? "bg-green-600" : "bg-gray-700"}`}
                  >
                    <span
                      className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${form[f.key] === "true" ? "left-4" : "left-0.5"}`}
                    />
                  </button>
                ) : (
                  <input
                    type={f.type === "color" ? "color" : f.type === "number" ? "number" : "text"}
                    value={form[f.key] ?? ""}
                    onChange={(e) => set(f.key, e.target.value)}
                    placeholder={f.placeholder}
                    className={`w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg px-2.5 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-red-600 ${f.type === "color" ? "h-9 p-1" : ""}`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              <Check size={13} />
              {saving ? "Saving…" : editId ? "Update" : "Add"}
            </button>
            <button
              onClick={() => {
                setShowForm(false);
                setEditId(null);
              }}
              className="flex items-center gap-1.5 border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              <X size={13} />
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-[var(--text-muted)] text-xs">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-[var(--text-muted)] text-xs py-4 text-center">{emptyMessage}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[var(--border-color)]">
                {columns.map((c) => (
                  <th key={c.key} className="px-2 py-2 text-left text-[var(--text-muted)] uppercase tracking-widest font-semibold">
                    {c.label}
                  </th>
                ))}
                <th className="px-2 py-2 text-right text-[var(--text-muted)] uppercase tracking-widest font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-white/2">
                  {columns.map((c) => (
                    <td key={c.key} className="px-2 py-2.5 text-[var(--text-primary)]">
                      {c.render ? c.render(row) : String(row[c.key] ?? "—")}
                    </td>
                  ))}
                  <td className="px-2 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openEdit(row)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1">
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={() => handleDelete(row.id)}
                        disabled={deletingId === row.id}
                        className="text-gray-600 hover:text-red-500 p-1 disabled:opacity-40"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
