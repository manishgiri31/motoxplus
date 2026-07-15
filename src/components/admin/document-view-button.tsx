"use client";

import { useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";

interface Props {
  documentId: string;
}

export function DocumentViewButton({ documentId }: Props) {
  const [loading, setLoading] = useState(false);

  const view = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/files/signed/${documentId}`);
      const data = await res.json();
      if (res.ok && data.signedUrl) {
        window.open(data.signedUrl, "_blank", "noopener,noreferrer");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={view}
      disabled={loading}
      className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-400 hover:text-red-300 transition-colors disabled:opacity-50 uppercase tracking-wider"
    >
      {loading ? <Loader2 size={12} className="animate-spin" /> : <ExternalLink size={12} />}
      View
    </button>
  );
}
