"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";

interface Props {
  dealerId: string;
  currentStatus: string;
}

export function AdminDealerActions({ dealerId, currentStatus }: Props) {
  const router = useRouter();
  const [loadingStatus, setLoadingStatus] = useState<string | null>(null);

  const updateStatus = async (status: string) => {
    setLoadingStatus(status);
    await fetch(`/api/admin/dealers/${dealerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    router.refresh();
    setLoadingStatus(null);
  };

  return (
    <div className="flex gap-2">
      {currentStatus !== "ACTIVE" && (
        <button
          onClick={() => updateStatus("ACTIVE")}
          disabled={!!loadingStatus}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-400 hover:text-green-300 transition-colors disabled:opacity-50 uppercase tracking-wider"
        >
          {loadingStatus === "ACTIVE" ? <Spinner size={12} /> : null}
          Approve
        </button>
      )}
      {currentStatus !== "REJECTED" && currentStatus !== "PENDING" && (
        <button
          onClick={() => updateStatus("SUSPENDED")}
          disabled={!!loadingStatus}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-400 hover:text-orange-300 transition-colors disabled:opacity-50 uppercase tracking-wider"
        >
          {loadingStatus === "SUSPENDED" ? <Spinner size={12} /> : null}
          Suspend
        </button>
      )}
      {currentStatus === "PENDING" && (
        <button
          onClick={() => updateStatus("REJECTED")}
          disabled={!!loadingStatus}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-400 hover:text-red-300 transition-colors disabled:opacity-50 uppercase tracking-wider"
        >
          {loadingStatus === "REJECTED" ? <Spinner size={12} /> : null}
          Reject
        </button>
      )}
    </div>
  );
}
