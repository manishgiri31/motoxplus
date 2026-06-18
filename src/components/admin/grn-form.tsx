"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PackageCheck, X, Loader2 } from "lucide-react";

interface POItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  receivedQty: number;
}

interface Props {
  purchaseOrderId: string;
  poItems: POItem[];
}

export function GRNForm({ purchaseOrderId, poItems }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const today = new Date().toISOString().split("T")[0];
  const [receivedAt, setReceivedAt] = useState(today);
  const [qualityStatus, setQualityStatus] = useState("ACCEPTED");
  const [notes, setNotes] = useState("");

  const [grnItems, setGrnItems] = useState(
    poItems.map((item) => ({
      description: item.description,
      orderedQuantity: item.quantity,
      receivedQuantity: item.quantity - item.receivedQty,
      acceptedQuantity: item.quantity - item.receivedQty,
      rejectedQuantity: 0,
      rejectionReason: "",
    }))
  );

  const updateGrnItem = (i: number, field: string, value: number | string) => {
    setGrnItems((prev) =>
      prev.map((item, idx) => {
        if (idx !== i) return item;
        const updated = { ...item, [field]: value };
        if (field === "receivedQuantity" || field === "rejectedQuantity") {
          const received = Number(field === "receivedQuantity" ? value : updated.receivedQuantity);
          const rejected = Number(field === "rejectedQuantity" ? value : updated.rejectedQuantity);
          updated.acceptedQuantity = Math.max(0, received - rejected);
        }
        return updated;
      })
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/procurement/grn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purchaseOrderId, receivedAt, qualityStatus, notes, items: grnItems }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setOpen(false);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full themed-input px-3 py-2 rounded-sm text-sm";
  const labelClass = "block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1";

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 bg-green-700 hover:bg-green-600 text-white font-bold px-4 py-2.5 rounded-sm text-sm uppercase tracking-wider transition-colors"
      >
        <PackageCheck size={16} />
        Record GRN
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative glass border border-[var(--border-color)] rounded-sm p-6 w-full max-w-2xl z-10 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-[var(--text-primary)] font-bold uppercase tracking-widest text-sm">Record Goods Receipt</h3>
              <button onClick={() => setOpen(false)}>
                <X size={18} className="text-[var(--text-muted)]" />
              </button>
            </div>

            {error && (
              <div className="mb-4 px-3 py-2 bg-red-900/20 border border-red-900/40 rounded-sm text-red-400 text-xs">{error}</div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Received Date *</label>
                  <input type="date" className={inputClass} value={receivedAt} onChange={(e) => setReceivedAt(e.target.value)} required />
                </div>
                <div>
                  <label className={labelClass}>Quality Status</label>
                  <select className={`${inputClass} themed-select`} value={qualityStatus} onChange={(e) => setQualityStatus(e.target.value)}>
                    <option value="ACCEPTED">Accepted</option>
                    <option value="PARTIAL">Partial</option>
                    <option value="REJECTED">Rejected</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="text-[var(--text-primary)] font-bold text-xs uppercase tracking-widest mb-3">Items Received</div>
                <div className="space-y-3">
                  {grnItems.map((item, i) => (
                    <div key={i} className="p-4 glass border border-[var(--border-color)] rounded-sm">
                      <div className="text-[var(--text-primary)] text-sm font-bold mb-3">{item.description}</div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                        <div>
                          <label className={labelClass}>Ordered</label>
                          <div className="themed-input px-3 py-2 rounded-sm text-sm text-[var(--text-muted)]">
                            {item.orderedQuantity}
                          </div>
                        </div>
                        <div>
                          <label className={labelClass}>Received *</label>
                          <input
                            type="number"
                            min="0"
                            max={item.orderedQuantity}
                            className={inputClass}
                            value={item.receivedQuantity}
                            onChange={(e) => updateGrnItem(i, "receivedQuantity", parseInt(e.target.value) || 0)}
                            required
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Rejected</label>
                          <input
                            type="number"
                            min="0"
                            max={item.receivedQuantity}
                            className={inputClass}
                            value={item.rejectedQuantity}
                            onChange={(e) => updateGrnItem(i, "rejectedQuantity", parseInt(e.target.value) || 0)}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Accepted</label>
                          <div className="themed-input px-3 py-2 rounded-sm text-sm text-green-400 font-bold">
                            {item.acceptedQuantity}
                          </div>
                        </div>
                      </div>
                      {item.rejectedQuantity > 0 && (
                        <div className="mt-3">
                          <label className={labelClass}>Rejection Reason</label>
                          <input className={inputClass} value={item.rejectionReason} onChange={(e) => updateGrnItem(i, "rejectionReason", e.target.value)} placeholder="Damaged / Wrong spec / Expired..." />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className={labelClass}>Notes</label>
                <textarea className={`${inputClass} resize-none`} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Delivery condition, packaging notes..." />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={loading} className="flex-1 flex items-center justify-center gap-2 bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white font-bold py-2.5 rounded-sm text-sm uppercase tracking-wider transition-colors">
                  {loading && <Loader2 size={14} className="animate-spin" />}
                  Save GRN
                </button>
                <button type="button" onClick={() => setOpen(false)} className="glass border border-[var(--border-color)] text-[var(--text-muted)] font-bold px-4 py-2.5 rounded-sm text-sm uppercase tracking-wider">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
