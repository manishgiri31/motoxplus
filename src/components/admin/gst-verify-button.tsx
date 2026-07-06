"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Shield } from "lucide-react";

interface Props {
  entity: "dealers" | "vendors";
  id: string;
  gstNumber: string | null;
  gstVerified: boolean;
}

export function GstVerifyButton({ entity, id, gstNumber, gstVerified }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  if (!gstNumber) return <span className="text-gray-600 text-xs">—</span>;

  const path = entity === "dealers" ? `/api/admin/dealers/${id}/gst-verify` : `/api/vendors/${id}/gst-verify`;

  const toggle = async () => {
    setLoading(true);
    await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verified: !gstVerified }),
    });
    router.refresh();
    setLoading(false);
  };

  return (
    <button
      onClick={toggle}
      disabled={loading}
      title={gstVerified ? "Click to clear GST verification" : "Mark GST as verified (internal check only)"}
      className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg transition-colors disabled:opacity-50 ${
        gstVerified ? "bg-green-900/20 text-green-400 hover:bg-green-900/30" : "bg-gray-900/20 text-[var(--text-muted)] hover:bg-gray-900/30"
      }`}
    >
      {gstVerified ? <ShieldCheck size={11} /> : <Shield size={11} />}
      {gstVerified ? "Verified" : "Unverified"}
    </button>
  );
}
