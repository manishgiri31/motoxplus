"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  dealerId: string;
  currentStatus: string;
}

export function AdminDealerActions({ dealerId, currentStatus }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const updateStatus = async (status: string) => {
    setLoading(true);
    await fetch(`/api/admin/dealers/${dealerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    router.refresh();
    setLoading(false);
  };

  return (
    <div className="flex gap-2">
      {currentStatus !== "APPROVED" && (
        <button
          onClick={() => updateStatus("APPROVED")}
          disabled={loading}
          className="text-xs font-semibold text-green-400 hover:text-green-300 transition-colors disabled:opacity-50 uppercase tracking-wider"
        >
          Approve
        </button>
      )}
      {currentStatus !== "REJECTED" && currentStatus !== "PENDING" && (
        <button
          onClick={() => updateStatus("SUSPENDED")}
          disabled={loading}
          className="text-xs font-semibold text-orange-400 hover:text-orange-300 transition-colors disabled:opacity-50 uppercase tracking-wider"
        >
          Suspend
        </button>
      )}
      {currentStatus === "PENDING" && (
        <button
          onClick={() => updateStatus("REJECTED")}
          disabled={loading}
          className="text-xs font-semibold text-red-400 hover:text-red-300 transition-colors disabled:opacity-50 uppercase tracking-wider"
        >
          Reject
        </button>
      )}
    </div>
  );
}
