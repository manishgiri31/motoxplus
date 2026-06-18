"use client";

import { useState } from "react";
import { X } from "lucide-react";

const ACTIVITY_TYPES = ["CALL", "EMAIL", "VISIT", "DEMO", "PROPOSAL", "FOLLOW_UP", "MEETING", "OTHER"];
const OUTCOMES = ["POSITIVE", "NEUTRAL", "NEGATIVE"];
const STATUSES = ["NEW", "CONTACTED", "INTERESTED", "NEGOTIATION", "LOST", "DORMANT"];

interface Props {
  leadId: string;
  currentStatus: string;
  onClose: () => void;
  onSaved: () => void;
}

export function ActivityForm({ leadId, currentStatus, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    type: "CALL",
    description: "",
    outcome: "",
    nextAction: "",
    updateStatus: false,
    newStatus: currentStatus,
    nextFollowUp: "",
  });

  function set(field: string, value: any) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/crm/leads/${leadId}/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: form.type,
          description: form.description,
          outcome: form.outcome || undefined,
          nextAction: form.nextAction || undefined,
          updateStatus: form.updateStatus,
          newStatus: form.updateStatus ? form.newStatus : undefined,
          nextFollowUp: form.nextFollowUp || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to log activity");
      onSaved();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="glass border border-[var(--border-color)] rounded-sm w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)]">
          <h2 className="text-lg font-black text-[var(--text-primary)] uppercase tracking-tight">Log Activity</h2>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-white transition-colors"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="bg-red-900/20 border border-red-800 text-red-400 px-3 py-2 rounded-sm text-sm">{error}</div>}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Activity Type *</label>
              <select required className="themed-select w-full" value={form.type} onChange={(e) => set("type", e.target.value)}>
                {ACTIVITY_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Outcome</label>
              <select className="themed-select w-full" value={form.outcome} onChange={(e) => set("outcome", e.target.value)}>
                <option value="">Select outcome</option>
                {OUTCOMES.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Description *</label>
            <textarea
              required
              rows={3}
              className="themed-input w-full"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="What happened during this interaction..."
            />
          </div>

          <div>
            <label className="block text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Next Action</label>
            <input className="themed-input w-full" value={form.nextAction} onChange={(e) => set("nextAction", e.target.value)} placeholder="What needs to happen next" />
          </div>

          <div>
            <label className="block text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Next Follow-up Date</label>
            <input type="date" className="themed-input w-full" value={form.nextFollowUp} onChange={(e) => set("nextFollowUp", e.target.value)} />
          </div>

          <div className="border border-[var(--border-color)] rounded-sm p-4 space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.updateStatus}
                onChange={(e) => set("updateStatus", e.target.checked)}
                className="accent-red-600"
              />
              <span className="text-sm text-[var(--text-secondary)] font-semibold">Update lead status</span>
            </label>
            {form.updateStatus && (
              <div>
                <label className="block text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1.5">New Status</label>
                <select className="themed-select w-full" value={form.newStatus} onChange={(e) => set("newStatus", e.target.value)}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading} className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-sm text-sm uppercase tracking-wider transition-colors">
              {loading ? "Saving..." : "Log Activity"}
            </button>
            <button type="button" onClick={onClose} className="glass border border-[var(--border-color)] text-[var(--text-muted)] font-bold px-5 py-2.5 rounded-sm text-sm uppercase tracking-wider hover:border-red-900/40 transition-colors">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
