"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, XCircle, Loader2, X } from "lucide-react";

export function PRActions({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);
  const [showReject, setShowReject] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  const act = async (action: "approve" | "reject") => {
    setLoading(action);
    await fetch(`/api/procurement/requests/${requestId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, rejectionReason }),
    });
    setLoading(null);
    setShowReject(false);
    router.refresh();
  };

  return (
    <>
      <div className="flex items-center gap-3">
        <button
          onClick={() => act("approve")}
          disabled={!!loading}
          className="flex items-center gap-1.5 text-xs font-semibold text-green-400 hover:text-green-300 disabled:opacity-50 uppercase tracking-wider transition-colors"
        >
          {loading === "approve" ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
          Approve
        </button>
        <button
          onClick={() => setShowReject(true)}
          disabled={!!loading}
          className="flex items-center gap-1.5 text-xs font-semibold text-red-400 hover:text-red-300 disabled:opacity-50 uppercase tracking-wider transition-colors"
        >
          <XCircle size={12} />
          Reject
        </button>
      </div>

      {showReject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowReject(false)} />
          <div className="relative glass border border-[var(--border-color)] rounded-sm p-6 w-full max-w-sm z-10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[var(--text-primary)] font-bold text-sm uppercase tracking-widest">Reject Request</h3>
              <button onClick={() => setShowReject(false)}>
                <X size={18} className="text-[var(--text-muted)]" />
              </button>
            </div>
            <textarea
              className="w-full themed-input px-3 py-2 rounded-sm text-sm resize-none mb-4"
              rows={3}
              placeholder="Reason for rejection..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
            />
            <div className="flex gap-3">
              <button
                onClick={() => act("reject")}
                disabled={!!loading}
                className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-sm text-sm uppercase tracking-wider transition-colors"
              >
                {loading === "reject" && <Loader2 size={14} className="animate-spin" />}
                Confirm Reject
              </button>
              <button onClick={() => setShowReject(false)} className="glass border border-[var(--border-color)] text-[var(--text-muted)] font-bold px-4 py-2.5 rounded-sm text-sm uppercase tracking-wider">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
