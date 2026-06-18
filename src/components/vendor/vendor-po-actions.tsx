"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, XCircle, Loader2, X } from "lucide-react";

export function VendorPOActions({ poId }: { poId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<"accept" | "reject" | null>(null);
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState("");

  const accept = async () => {
    setLoading("accept");
    await fetch(`/api/vendor/purchase-orders/${poId}/accept`, { method: "PATCH" });
    setLoading(null);
    router.refresh();
  };

  const reject = async () => {
    setLoading("reject");
    await fetch(`/api/vendor/purchase-orders/${poId}/reject`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    setLoading(null);
    setShowReject(false);
    router.refresh();
  };

  return (
    <>
      <div className="flex flex-col gap-2">
        <button
          onClick={accept}
          disabled={!!loading}
          className="flex items-center justify-center gap-1.5 bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-sm text-xs uppercase tracking-wider transition-colors"
        >
          {loading === "accept" ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
          Accept
        </button>
        <button
          onClick={() => setShowReject(true)}
          disabled={!!loading}
          className="flex items-center justify-center gap-1.5 glass border border-red-900/40 hover:border-red-600/60 text-red-400 font-bold px-4 py-2 rounded-sm text-xs uppercase tracking-wider transition-colors"
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
              <h3 className="text-[var(--text-primary)] font-bold text-sm uppercase tracking-widest">Reject Order</h3>
              <button onClick={() => setShowReject(false)}>
                <X size={18} className="text-[var(--text-muted)]" />
              </button>
            </div>
            <p className="text-[var(--text-muted)] text-sm mb-4">
              Please provide a reason so MOTOXPLUS can take corrective action.
            </p>
            <textarea
              className="w-full themed-input px-3 py-2 rounded-sm text-sm resize-none mb-4"
              rows={3}
              placeholder="Cannot fulfil due to capacity / pricing mismatch / out of stock..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <div className="flex gap-3">
              <button
                onClick={reject}
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
