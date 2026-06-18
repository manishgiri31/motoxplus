"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  vendorId: string;
  currentStatus: string;
}

export function VendorStatusActions({ vendorId, currentStatus }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const updateStatus = async (status: string) => {
    setLoading(true);
    await fetch(`/api/vendors/${vendorId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    router.refresh();
    setLoading(false);
  };

  return (
    <div className="flex gap-3 flex-wrap">
      {currentStatus !== "APPROVED" && currentStatus !== "BLACKLISTED" && (
        <button
          onClick={() => updateStatus("APPROVED")}
          disabled={loading}
          className="text-xs font-semibold text-green-400 hover:text-green-300 transition-colors disabled:opacity-50 uppercase tracking-wider"
        >
          Approve
        </button>
      )}
      {currentStatus === "APPROVED" && (
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
      {currentStatus !== "BLACKLISTED" && currentStatus !== "PENDING" && (
        <button
          onClick={() => updateStatus("BLACKLISTED")}
          disabled={loading}
          className="text-xs font-semibold text-purple-400 hover:text-purple-300 transition-colors disabled:opacity-50 uppercase tracking-wider"
        >
          Blacklist
        </button>
      )}
    </div>
  );
}
