"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

export function RetryRefundAction({ cancellationId }: { cancellationId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const retry = async () => {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/admin/refunds/${cancellationId}/retry`, { method: "POST" });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Retry failed");
      return;
    }
    router.refresh();
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={retry}
        disabled={loading}
        className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-red-400 hover:text-red-300 disabled:opacity-50 transition-colors"
      >
        <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
        {loading ? "Retrying…" : "Retry refund"}
      </button>
      {error && <p className="text-red-400 text-[10px] max-w-[160px] text-right">{error}</p>}
    </div>
  );
}
