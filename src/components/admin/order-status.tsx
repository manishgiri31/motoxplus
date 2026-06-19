"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";

const statuses = ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"];

export function AdminOrderStatus({ orderId, currentStatus }: { orderId: string; currentStatus: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const updateStatus = async (status: string) => {
    if (status === currentStatus) return;
    setLoading(true);
    await fetch(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    router.refresh();
    setLoading(false);
  };

  return (
    <div className="relative inline-flex items-center gap-2">
      {loading && <Spinner size={12} className="text-red-400" />}
      <select
        value={currentStatus}
        onChange={(e) => updateStatus(e.target.value)}
        disabled={loading}
        className="themed-input border focus:border-red-600/60 rounded-sm px-2 py-1.5 text-xs outline-none transition-colors disabled:opacity-50"
      >
        {statuses.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
    </div>
  );
}
