"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function AdminProductActions({ productId, isActive }: { productId: string; isActive: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const toggleActive = async () => {
    setLoading(true);
    await fetch(`/api/products/${productId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    router.refresh();
    setLoading(false);
  };

  return (
    <div className="flex gap-3">
      <Link
        href={`/admin/products/${productId}/edit`}
        className="text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors uppercase tracking-wider"
      >
        Edit
      </Link>
      <button
        onClick={toggleActive}
        disabled={loading}
        className={`text-xs font-semibold transition-colors disabled:opacity-50 uppercase tracking-wider ${isActive ? "text-red-400 hover:text-red-300" : "text-green-400 hover:text-green-300"}`}
      >
        {isActive ? "Deactivate" : "Activate"}
      </button>
    </div>
  );
}
