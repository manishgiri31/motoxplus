"use client";

import { useState } from "react";
import { CheckCircle2, XCircle, Eye } from "lucide-react";
import { useRouter } from "next/navigation";
import { Spinner as SpinnerComp } from "@/components/ui/spinner";

interface Props {
  submissionId: string;
  status: string;
}

export function PaymentActions({ submissionId, status }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<"verify" | "reject" | "review" | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [error, setError] = useState("");

  const doReview = async () => {
    setLoading("review");
    await fetch(`/api/admin/payments/${submissionId}/review`, { method: "POST" });
    setLoading(null);
    router.refresh();
  };

  const doVerify = async () => {
    setLoading("verify");
    const res = await fetch(`/api/admin/payments/${submissionId}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    setLoading(null);
    if (!res.ok) {
      const d = await res.json();
      setError(d.error || "Verification failed.");
      return;
    }
    router.refresh();
  };

  const doReject = async () => {
    if (!rejectReason.trim()) { setError("Rejection reason is required."); return; }
    setLoading("reject");
    const res = await fetch(`/api/admin/payments/${submissionId}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: rejectReason.trim() }),
    });
    setLoading(null);
    setShowRejectModal(false);
    if (!res.ok) {
      const d = await res.json();
      setError(d.error || "Rejection failed.");
      return;
    }
    router.refresh();
  };

  return (
    <>
      {error && <p className="text-red-400 text-xs mb-2">{error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        {status === "SUBMITTED" && (
          <button
            onClick={doReview}
            disabled={!!loading}
            className="flex items-center gap-1.5 text-xs font-bold text-yellow-400 hover:text-yellow-300 border border-yellow-400/30 hover:border-yellow-400/60 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading === "review" ? <SpinnerComp size={12} /> : <Eye size={12} />}
            Mark Under Review
          </button>
        )}

        <button
          onClick={doVerify}
          disabled={!!loading}
          className="flex items-center gap-1.5 text-xs font-bold text-white bg-green-700 hover:bg-green-600 px-4 py-1.5 rounded-lg transition-colors disabled:opacity-50"
        >
          {loading === "verify" ? <SpinnerComp size={12} /> : <CheckCircle2 size={12} />}
          Approve Payment
        </button>

        <button
          onClick={() => { setShowRejectModal(true); setError(""); }}
          disabled={!!loading}
          className="flex items-center gap-1.5 text-xs font-bold text-red-400 hover:text-red-300 border border-red-400/30 hover:border-red-400/60 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
        >
          <XCircle size={12} /> Reject
        </button>
      </div>

      {showRejectModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass border border-[var(--border-color)] rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-[var(--text-primary)] font-bold mb-4">Reject Payment</h3>
            <p className="text-[var(--text-muted)] text-sm mb-4">Provide a reason that will be shared with the dealer so they can resubmit.</p>
            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. UTR number not found in bank records"
              className="w-full themed-input border rounded-xl px-4 py-3 text-sm outline-none transition-colors focus:border-red-600/60 resize-none mb-4"
            />
            {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
            <div className="flex gap-3">
              <button
                onClick={() => { setShowRejectModal(false); setRejectReason(""); setError(""); }}
                className="flex-1 border border-[var(--border-color)] text-[var(--text-muted)] font-bold py-3 rounded-xl text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={doReject}
                disabled={loading === "reject"}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading === "reject" ? <SpinnerComp size={14} /> : null}
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
