"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

export function StaffActions({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setLoading(true);
    try {
      await fetch(`/api/staff/${id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setLoading(false);
      setConfirming(false);
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2 justify-end">
        <span className="text-xs text-[var(--text-muted)]">Remove {name}?</span>
        <button onClick={handleDelete} disabled={loading} className="text-xs bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold px-3 py-1.5 rounded-sm uppercase tracking-wider transition-colors">
          {loading ? "..." : "Yes"}
        </button>
        <button onClick={() => setConfirming(false)} className="text-xs glass border border-[var(--border-color)] text-[var(--text-muted)] font-bold px-3 py-1.5 rounded-sm uppercase tracking-wider transition-colors">
          No
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="text-[var(--text-muted)] hover:text-red-400 transition-colors p-1.5"
      title="Remove staff"
    >
      <Trash2 size={15} />
    </button>
  );
}
