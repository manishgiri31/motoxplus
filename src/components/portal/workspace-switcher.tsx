"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeftRight, Plus } from "lucide-react";
import { WORKSPACE_INFO, isWorkspace, type Workspace } from "@/lib/auth/workspaces";

export interface WorkspaceUser {
  role?: string;
  dealerId?: string;
  vendorId?: string;
  customerId?: string;
}

/** Where to add the profile this account doesn't have yet (same login; only business details are asked for). */
const ADD_PROFILE: Partial<Record<Workspace, { href: string; label: string }>> = {
  VENDOR: { href: "/become-vendor#start", label: "Start selling: add a vendor profile" },
  DEALER: { href: "/become-dealer", label: "Buy at dealer prices: add a dealer profile" },
};

/**
 * Sidebar block for one login with several profiles (lib/auth/workspaces.ts): switch between the dealer/customer
 * (buying) and vendor (selling) workspaces of the same account, or add the missing one. Profile ids come from the
 * session, which /api/auth/switch-workspace re-issues on every switch.
 */
export function WorkspaceSwitcher({ user }: { user: WorkspaceUser }) {
  const [busy, setBusy] = React.useState<Workspace | null>(null);
  const [error, setError] = React.useState("");
  if (!isWorkspace(user.role)) return null;
  const current = user.role;

  const owned: Workspace[] = [];
  if (user.dealerId) owned.push("DEALER");
  if (user.customerId) owned.push("CUSTOMER");
  if (user.vendorId) owned.push("VENDOR");
  const others = owned.filter((w) => w !== current);

  // Buyers can add selling; sellers can add dealer buying. (Customer <-> dealer is a separate account change.)
  const add: Workspace | null = current === "VENDOR" ? (user.dealerId ? null : "DEALER") : user.vendorId ? null : "VENDOR";

  async function switchTo(w: Workspace) {
    setBusy(w);
    setError("");
    try {
      const res = await fetch("/api/auth/switch-workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace: w }),
      });
      const body = (await res.json().catch(() => ({}))) as { redirectTo?: string; error?: string };
      if (!res.ok) throw new Error(body.error || "Couldn't switch. Please try again.");
      // Full load: the new session cookies must reach the server components and the NextAuth client.
      window.location.assign(body.redirectTo || WORKSPACE_INFO[w].home);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't switch. Please try again.");
      setBusy(null);
    }
  }

  if (others.length === 0 && !add) return null;

  return (
    <div className="px-4 pb-2">
      <p className="px-1 pb-1.5 text-12 font-semibold uppercase tracking-wide text-[var(--text-muted)]">Same login</p>
      <div className="space-y-1">
        {others.map((w) => (
          <button
            key={w}
            type="button"
            onClick={() => switchTo(w)}
            disabled={busy !== null}
            aria-busy={busy === w}
            className="flex w-full items-center gap-3 rounded-lg border border-[var(--border-color)] px-3 py-2.5 text-left transition-colors hover:bg-[var(--bg-card-hover)] disabled:opacity-60"
          >
            <ArrowLeftRight size={16} className="shrink-0 text-[var(--accent)]" aria-hidden />
            <span className="min-w-0">
              <span className="block text-14 font-semibold text-[var(--text-primary)]">
                {busy === w ? "Switching…" : `Switch to ${WORKSPACE_INFO[w].label}`}
              </span>
              <span className="block text-12 text-[var(--text-muted)]">{WORKSPACE_INFO[w].purpose}</span>
            </span>
          </button>
        ))}
        {add && ADD_PROFILE[add] && (
          <Link
            href={ADD_PROFILE[add]!.href}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-14 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-primary)]"
          >
            <Plus size={16} className="shrink-0" aria-hidden />
            <span>{ADD_PROFILE[add]!.label}</span>
          </Link>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-1.5 px-1 text-12 text-[var(--sig-danger-fg,#b91c1c)]">
          {error}
        </p>
      )}
    </div>
  );
}
