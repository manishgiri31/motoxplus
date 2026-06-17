"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { Trash2, AlertTriangle, X } from "lucide-react";

export function DeleteAccountDialog() {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const CONFIRM_WORD = "DELETE";
  const isReady = confirm === CONFIRM_WORD;

  const handleDelete = async () => {
    if (!isReady) return;
    setLoading(true);
    setError("");

    const res = await fetch("/api/dealer/account", { method: "DELETE" });

    if (res.ok) {
      await signOut({ callbackUrl: "/?deleted=1" });
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to delete account. Please try again.");
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return;
    setOpen(false);
    setConfirm("");
    setError("");
  };

  return (
    <>
      {/* Danger Zone Card */}
      <div className="mt-8 border border-red-900/40 rounded-sm p-6 bg-red-900/5">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-sm bg-red-900/20 border border-red-900/40 flex items-center justify-center flex-shrink-0 mt-0.5">
            <AlertTriangle size={18} className="text-red-500" />
          </div>
          <div className="flex-1">
            <h3 className="text-[var(--text-primary)] font-bold mb-1">Danger Zone</h3>
            <p className="text-[var(--text-muted)] text-sm leading-relaxed mb-4">
              Permanently delete your dealer account and all associated data — orders, invoices,
              cart, and profile. This action is <strong className="text-red-400">irreversible</strong>.
            </p>
            <button
              onClick={() => setOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-red-900/20 hover:bg-red-900/40 border border-red-700/50 hover:border-red-600 text-red-400 hover:text-red-300 rounded-sm text-sm font-semibold transition-all duration-200"
            >
              <Trash2 size={15} />
              Delete My Account
            </button>
          </div>
        </div>
      </div>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Dialog */}
          <div className="relative z-10 w-full max-w-md glass border border-red-900/50 rounded-sm p-6 shadow-2xl">
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-sm bg-red-900/30 border border-red-800/50 flex items-center justify-center">
                  <Trash2 size={18} className="text-red-500" />
                </div>
                <div>
                  <h2 className="text-[var(--text-primary)] font-black text-lg">Delete Account</h2>
                  <p className="text-red-400 text-xs font-semibold uppercase tracking-wider">Permanent Action</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                disabled={loading}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-40"
              >
                <X size={20} />
              </button>
            </div>

            {/* Warning list */}
            <div className="bg-red-950/30 border border-red-900/30 rounded-sm p-4 mb-5">
              <p className="text-[var(--text-secondary)] text-sm font-semibold mb-3">
                This will permanently delete:
              </p>
              <ul className="space-y-1.5">
                {[
                  "Your dealer account and login access",
                  "All orders and order history",
                  "All invoices",
                  "Cart and saved items",
                  "All account data and profile",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-[var(--text-muted)]">
                    <span className="text-red-500 mt-0.5 flex-shrink-0">✕</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Confirm input */}
            <div className="mb-5">
              <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider block mb-2">
                Type <strong className="text-red-400 font-mono">{CONFIRM_WORD}</strong> to confirm
              </label>
              <input
                type="text"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value.toUpperCase())}
                disabled={loading}
                placeholder={CONFIRM_WORD}
                className="w-full themed-input border focus:border-red-600 rounded-sm px-4 py-3 text-sm outline-none transition-colors font-mono tracking-widest disabled:opacity-50"
                autoComplete="off"
              />
            </div>

            {error && (
              <p className="text-red-400 text-sm mb-4 bg-red-900/10 border border-red-900/30 rounded-sm px-3 py-2">
                {error}
              </p>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={handleClose}
                disabled={loading}
                className="flex-1 px-4 py-3 glass border border-[var(--border-color)] hover:border-[var(--border-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-sm text-sm font-semibold transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={!isReady || loading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-700 hover:bg-red-600 disabled:bg-red-900/40 disabled:text-red-700 text-white rounded-sm text-sm font-bold transition-all duration-200"
              >
                {loading ? (
                  <span className="animate-pulse">Deleting...</span>
                ) : (
                  <>
                    <Trash2 size={15} />
                    Delete Forever
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
