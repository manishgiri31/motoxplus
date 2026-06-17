"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, ShieldOff, Trash2, Loader2 } from "lucide-react";

interface Props {
  adminId?: string;
  userId: string;
  isSuperAdmin?: boolean;
  isPromotion?: boolean;
}

export function AdminAdminActions({ adminId, userId, isSuperAdmin = false, isPromotion = false }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function promote() {
    setLoading("promote");
    await fetch("/api/admins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, isSuperAdmin: false }),
    });
    router.refresh();
    setLoading(null);
  }

  async function toggleSuperAdmin() {
    if (!adminId) return;
    setLoading("toggle");
    await fetch(`/api/admins/${adminId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isSuperAdmin: !isSuperAdmin }),
    });
    router.refresh();
    setLoading(null);
  }

  async function revoke() {
    if (!adminId) return;
    if (!confirm("Revoke admin access? This will demote the user to Guest.")) return;
    setLoading("revoke");
    await fetch(`/api/admins/${adminId}`, { method: "DELETE" });
    router.refresh();
    setLoading(null);
  }

  if (isPromotion) {
    return (
      <button
        onClick={promote}
        disabled={loading === "promote"}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-red-600/10 text-red-500 hover:bg-red-600/20 text-xs font-semibold transition-colors disabled:opacity-50"
      >
        {loading === "promote" ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <ShieldCheck className="w-3.5 h-3.5" />
        )}
        Make Admin
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={toggleSuperAdmin}
        disabled={!!loading}
        title={isSuperAdmin ? "Demote to Admin" : "Promote to Super Admin"}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm text-xs font-semibold transition-colors disabled:opacity-50 glass border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-red-600/50"
      >
        {loading === "toggle" ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : isSuperAdmin ? (
          <ShieldOff className="w-3.5 h-3.5" />
        ) : (
          <ShieldCheck className="w-3.5 h-3.5 text-red-500" />
        )}
        {isSuperAdmin ? "Demote" : "Make Super"}
      </button>

      <button
        onClick={revoke}
        disabled={!!loading}
        title="Revoke admin access"
        className="p-1.5 rounded-sm text-[var(--text-muted)] hover:text-red-500 hover:bg-red-900/10 transition-colors disabled:opacity-50"
      >
        {loading === "revoke" ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Trash2 className="w-3.5 h-3.5" />
        )}
      </button>
    </div>
  );
}
