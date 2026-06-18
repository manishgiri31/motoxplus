"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, Loader2 } from "lucide-react";

const URGENCIES = ["LOW", "NORMAL", "HIGH", "CRITICAL"];
const DEPARTMENTS = ["GENERAL", "PRODUCTION", "DISPATCH", "ACCOUNTS", "SALES", "MARKETING"];
const UNITS = ["PCS", "KG", "MTR", "LTR", "BOX", "SET", "ROLL", "SHEET"];

interface Item {
  description: string;
  quantity: string;
  unit: string;
  estimatedUnitPrice: string;
  notes: string;
}

export default function NewPurchaseRequestPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    title: "",
    urgency: "NORMAL",
    departmentCode: "GENERAL",
    notes: "",
  });

  const [items, setItems] = useState<Item[]>([
    { description: "", quantity: "1", unit: "PCS", estimatedUnitPrice: "", notes: "" },
  ]);

  const addItem = () =>
    setItems((prev) => [
      ...prev,
      { description: "", quantity: "1", unit: "PCS", estimatedUnitPrice: "", notes: "" },
    ]);

  const removeItem = (i: number) => setItems((prev) => prev.filter((_, idx) => idx !== i));

  const updateItem = (i: number, field: keyof Item, value: string) =>
    setItems((prev) => prev.map((item, idx) => (idx === i ? { ...item, [field]: value } : item)));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/procurement/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, items }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      router.push(`/admin/procurement/requests/${data.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full themed-input px-3 py-2.5 rounded-sm text-sm";
  const labelClass = "block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1.5";

  return (
    <div className="max-w-4xl">
      <div className="mb-8 flex items-center gap-4">
        <Link href="/admin/procurement/requests" className="glass border border-[var(--border-color)] p-2 rounded-sm hover:border-red-900/40 transition-colors">
          <ArrowLeft size={18} className="text-[var(--text-muted)]" />
        </Link>
        <div>
          <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight">New Purchase Request</h1>
          <p className="text-[var(--text-muted)] mt-1">Submit a request for materials or services</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 px-4 py-3 bg-red-900/20 border border-red-900/40 rounded-sm text-red-400 text-sm">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="glass border border-[var(--border-color)] rounded-sm p-6">
          <h2 className="text-[var(--text-primary)] font-bold mb-5 text-sm uppercase tracking-widest">Request Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className={labelClass}>Title *</label>
              <input
                className={inputClass}
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                required
                placeholder="Steel rods for Q3 production run"
              />
            </div>
            <div>
              <label className={labelClass}>Urgency</label>
              <select
                className={`${inputClass} themed-select`}
                value={form.urgency}
                onChange={(e) => setForm((p) => ({ ...p, urgency: e.target.value }))}
              >
                {URGENCIES.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Department</label>
              <select
                className={`${inputClass} themed-select`}
                value={form.departmentCode}
                onChange={(e) => setForm((p) => ({ ...p, departmentCode: e.target.value }))}
              >
                {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className={labelClass}>Notes</label>
              <textarea
                className={`${inputClass} resize-none`}
                rows={2}
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                placeholder="Additional context for approver..."
              />
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="glass border border-[var(--border-color)] rounded-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-[var(--text-primary)] font-bold text-sm uppercase tracking-widest">Items Required</h2>
            <button
              type="button"
              onClick={addItem}
              className="flex items-center gap-1.5 text-xs font-semibold text-red-400 hover:text-red-300 uppercase tracking-wider transition-colors"
            >
              <Plus size={14} />
              Add Item
            </button>
          </div>

          <div className="space-y-4">
            {items.map((item, i) => (
              <div key={i} className="p-4 glass border border-[var(--border-color)] rounded-sm">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[var(--text-muted)] text-xs font-semibold uppercase tracking-wider">Item {i + 1}</span>
                  {items.length > 1 && (
                    <button type="button" onClick={() => removeItem(i)}>
                      <Trash2 size={14} className="text-red-500 hover:text-red-400" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2">
                    <label className={labelClass}>Description *</label>
                    <input
                      className={inputClass}
                      value={item.description}
                      onChange={(e) => updateItem(i, "description", e.target.value)}
                      required
                      placeholder="MS Steel Rod 12mm dia"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={labelClass}>Qty *</label>
                      <input
                        type="number"
                        min="1"
                        className={inputClass}
                        value={item.quantity}
                        onChange={(e) => updateItem(i, "quantity", e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Unit</label>
                      <select
                        className={`${inputClass} themed-select`}
                        value={item.unit}
                        onChange={(e) => updateItem(i, "unit", e.target.value)}
                      >
                        {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Est. Unit Price (₹)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className={inputClass}
                      value={item.estimatedUnitPrice}
                      onChange={(e) => updateItem(i, "estimatedUnitPrice", e.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className={labelClass}>Notes</label>
                    <input
                      className={inputClass}
                      value={item.notes}
                      onChange={(e) => updateItem(i, "notes", e.target.value)}
                      placeholder="Spec / brand preference..."
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold px-6 py-3 rounded-sm text-sm uppercase tracking-wider transition-colors"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            Submit Request
          </button>
          <Link href="/admin/procurement/requests" className="glass border border-[var(--border-color)] hover:border-red-900/40 text-[var(--text-muted)] font-bold px-6 py-3 rounded-sm text-sm uppercase tracking-wider transition-colors">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
