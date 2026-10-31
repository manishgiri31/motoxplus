"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { CheckCircle2, XCircle, Pencil } from "lucide-react";

interface VerificationStatusCardProps {
  email: string;
  emailVerified: boolean;
  mobileVerified: boolean;
  gstNumber: string | null;
  gstVerified: boolean;
  accountStatus: string;
}

export function VerificationStatusCard({
  email,
  emailVerified,
  mobileVerified,
  gstNumber,
  gstVerified,
  accountStatus,
}: VerificationStatusCardProps) {
  const router = useRouter();
  const { update } = useSession();
  const [editingEmail, setEditingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");

  const gstLabel = !gstNumber ? "Not Provided" : gstVerified ? "Verified" : "Provided (Unverified)";

  async function handleChangeEmail(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading"); setError("");
    const res = await fetch("/api/auth/change-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newEmail }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error || "Failed to update email"); setStatus("error"); return; }
    await update();
    router.push(`/verify-email?userId=${data.userId}`);
    router.refresh();
  }

  return (
    <div className="bg-[var(--card)] rounded-[18px] p-6">
      <h2 className="text-[var(--text-primary)] font-bold text-sm mb-5">
        Verification Status
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <StatusRow label="Email Verified" ok={emailVerified} detail={email} />
        <StatusRow label="Mobile Verified" ok={mobileVerified} />
        <StatusRow label="GST" ok={gstVerified} neutralLabel={!gstNumber ? gstLabel : undefined} detail={gstVerified ? gstLabel : gstNumber ? gstLabel : undefined} />
        <StatusRow label="Account Status" ok={accountStatus === "ACTIVE" || accountStatus === "APPROVED"} neutralLabel={accountStatus} />
      </div>

      {!editingEmail ? (
        <button
          onClick={() => { setEditingEmail(true); setNewEmail(email); }}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-400 hover:text-red-300 transition-colors"
        >
          <Pencil size={12} /> Change Email
        </button>
      ) : (
        <form onSubmit={handleChangeEmail} className="flex flex-col sm:flex-row gap-2 mt-2">
          <input
            type="email"
            required
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            className="flex-1 themed-input border focus:border-[var(--red)]/60 rounded-lg px-3 py-2 text-sm outline-none transition-colors"
            placeholder="new-email@company.com"
          />
          <button
            type="submit"
            disabled={status === "loading"}
            className="bg-[var(--red)] hover:bg-[var(--red-hover)] disabled:opacity-50 text-white font-normal px-4 py-2 rounded-pill text-17 transition-colors"
          >
            {status === "loading" ? "Saving..." : "Save & Verify"}
          </button>
          <button
            type="button"
            onClick={() => { setEditingEmail(false); setError(""); }}
            className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] text-xs px-2"
          >
            Cancel
          </button>
        </form>
      )}
      {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
    </div>
  );
}

function StatusRow({
  label,
  ok,
  detail,
  neutralLabel,
}: {
  label: string;
  ok: boolean;
  detail?: string;
  neutralLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between p-3 bg-[var(--card)] border border-[var(--line)] rounded-lg">
      <div>
        <div className="text-[var(--text-muted)] text-xs">{label}</div>
        {detail && <div className="text-[var(--text-primary)] text-xs mt-0.5">{detail}</div>}
      </div>
      <span className={`inline-flex items-center gap-1 text-xs font-bold ${ok ? "text-green-400" : "text-yellow-400"}`}>
        {ok ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
        {neutralLabel ?? (ok ? "Yes" : "No")}
      </span>
    </div>
  );
}
