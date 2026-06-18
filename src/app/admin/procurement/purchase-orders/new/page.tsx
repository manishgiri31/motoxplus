"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, Loader2 } from "lucide-react";

const URGENCIES = ["LOW", "NORMAL", "HIGH", "CRITICAL"];
const UNITS = ["PCS", "KG", "MTR", "LTR", "BOX", "SET", "ROLL", "SHEET"];

interface LineItem {
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  gstRate: string;
}

export default function NewPurchaseOrderPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prId = searchParams.get("prId");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [vendors, setVendors] = useState<any[]>([]);

  const today = new Date();
  today.setDate(today.getDate() + 7);
  const defaultDelivery = today.toISOString().split("T")[0];

  const [form, setForm] = useState({
    vendorId: "",
    purchaseRequestId: prId || "",
    urgency: "NORMAL",
    deliveryDate: defaultDelivery,
    deliveryAddress: "MOTOXPLUS India Pvt Ltd, Factory Premises",
    termsAndConditions: "Payment within 30 days of delivery and acceptance of goods.",
  });

  const [items, setItems] = useState<LineItem[]>([
    { description: "", quantity: "1", unit: "PCS", unitPrice: "", gstRate: "18" },
  ]);

  useEffect(() => {
    fetch("/api/vendors?status=APPROVED")
      .then((r) => r.json())
      .then((d) => setVendors(d.vendors || []));
  }, []);

  const addItem = () =>
    setItems((p) => [...p, { description: "", quantity: "1", unit: "PCS", unitPrice: "", gstRate: "18" }]);

  const removeItem = (i: number) => setItems((p) => p.filter((_, idx) => idx !== i));

  const updateItem = (i: number, field: keyof LineItem, value: string) =>
    setItems((p) => p.map((item, idx) => (idx === i ? { ...item, [field]: value } : item)));

  const getLineTotal = (item: LineItem) => {
    const qty = parseFloat(item.quantity) || 0;
    const price = parseFloat(item.unitPrice) || 0;
    const gst = parseFloat(item.gstRate) || 0;
    return qty * price * (1 + gst / 100);
  };

  const grandTotal = items.reduce((s, item) => s + getLineTotal(item), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/procurement/purchase-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, items }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      router.push(`/admin/procurement/purchase-orders/${data.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full themed-input px-3 py-2.5 rounded-sm text-sm";
  const labelClass = "block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1.5";

  return (
    <div className="max-w-5xl">
      <div className="mb-8 flex items-center gap-4">
        <Link href="/admin/procurement/purchase-orders" className="glass border border-[var(--border-color)] p-2 rounded-sm hover:border-red-900/40 transition-colors">
          <ArrowLeft size={18} className="text-[var(--text-muted)]" />
        </Link>
        <div>
          <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight">Create Purchase Order</h1>
          <p className="text-[var(--text-muted)] mt-1">Send a PO to an approved vendor</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 px-4 py-3 bg-red-900/20 border border-red-900/40 rounded-sm text-red-400 text-sm">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Header */}
        <div className="glass border border-[var(--border-color)] rounded-sm p-6">
          <h2 className="text-[var(--text-primary)] font-bold mb-5 text-sm uppercase tracking-widest">Order Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Vendor *</label>
              <select
                className={`${inputClass} themed-select`}
                value={form.vendorId}
                onChange={(e) => setForm((p) => ({ ...p, vendorId: e.target.value }))}
                required
              >
                <option value="">Select vendor</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>{v.companyName} ({v.vendorCode})</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Urgency</label>
              <select className={`${inputClass} themed-select`} value={form.urgency} onChange={(e) => setForm((p) => ({ ...p, urgency: e.target.value }))}>
                {URGENCIES.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Expected Delivery *</label>
              <input type="date" className={inputClass} value={form.deliveryDate} onChange={(e) => setForm((p) => ({ ...p, deliveryDate: e.target.value }))} required />
            </div>
            <div>
              <label className={labelClass}>Delivery Address *</label>
              <input className={inputClass} value={form.deliveryAddress} onChange={(e) => setForm((p) => ({ ...p, deliveryAddress: e.target.value }))} required />
            </div>
            <div className="md:col-span-2">
              <label className={labelClass}>Terms & Conditions</label>
              <textarea className={`${inputClass} resize-none`} rows={2} value={form.termsAndConditions} onChange={(e) => setForm((p) => ({ ...p, termsAndConditions: e.target.value }))} />
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="glass border border-[var(--border-color)] rounded-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-[var(--text-primary)] font-bold text-sm uppercase tracking-widest">Line Items</h2>
            <button type="button" onClick={addItem} className="flex items-center gap-1.5 text-xs font-semibold text-red-400 hover:text-red-300 uppercase tracking-wider transition-colors">
              <Plus size={14} />Add Item
            </button>
          </div>

          <div className="space-y-3">
            {items.map((item, i) => (
              <div key={i} className="p-4 glass border border-[var(--border-color)] rounded-sm">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[var(--text-muted)] text-xs font-semibold uppercase tracking-wider">Item {i + 1}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-[var(--text-primary)] font-bold text-sm">
                      ₹{getLineTotal(item).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                    {items.length > 1 && (
                      <button type="button" onClick={() => removeItem(i)}>
                        <Trash2 size={14} className="text-red-500 hover:text-red-400" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div className="col-span-2 md:col-span-2">
                    <label className={labelClass}>Description *</label>
                    <input className={inputClass} value={item.description} onChange={(e) => updateItem(i, "description", e.target.value)} required placeholder="Item description" />
                  </div>
                  <div>
                    <label className={labelClass}>Qty *</label>
                    <input type="number" min="1" className={inputClass} value={item.quantity} onChange={(e) => updateItem(i, "quantity", e.target.value)} required />
                  </div>
                  <div>
                    <label className={labelClass}>Unit</label>
                    <select className={`${inputClass} themed-select`} value={item.unit} onChange={(e) => updateItem(i, "unit", e.target.value)}>
                      {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Unit Price *</label>
                    <input type="number" min="0" step="0.01" className={inputClass} value={item.unitPrice} onChange={(e) => updateItem(i, "unitPrice", e.target.value)} required placeholder="0.00" />
                  </div>
                  <div>
                    <label className={labelClass}>GST %</label>
                    <select className={`${inputClass} themed-select`} value={item.gstRate} onChange={(e) => updateItem(i, "gstRate", e.target.value)}>
                      {["0", "5", "12", "18", "28"].map((r) => <option key={r} value={r}>{r}%</option>)}
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 pt-5 border-t border-[var(--border-color)] flex justify-end">
            <div className="text-right">
              <div className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-1">Grand Total</div>
              <div className="text-2xl font-black text-[var(--text-primary)]">
                ₹{grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={loading} className="flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold px-6 py-3 rounded-sm text-sm uppercase tracking-wider transition-colors">
            {loading && <Loader2 size={16} className="animate-spin" />}
            Send Purchase Order
          </button>
          <Link href="/admin/procurement/purchase-orders" className="glass border border-[var(--border-color)] hover:border-red-900/40 text-[var(--text-muted)] font-bold px-6 py-3 rounded-sm text-sm uppercase tracking-wider transition-colors">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
