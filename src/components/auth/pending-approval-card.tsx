"use client";

import { signOut } from "next-auth/react";
import { useState } from "react";
import { Clock3, XCircle, Ban } from "lucide-react";

interface PendingApprovalCardProps {
  role: string;
  status?: string;
}

const STATUS_COPY: Record<string, { icon: React.ReactNode; title: string; text: string }> = {
  PENDING: {
    icon: <Clock3 size={28} className="text-yellow-400" />,
    title: "Application Under Review",
    text: "Your account is verified and pending approval from our team. We'll notify you by email once it's active — this usually takes 1-3 business days.",
  },
  REJECTED: {
    icon: <XCircle size={28} className="text-red-400" />,
    title: "Application Rejected",
    text: "Your application was not approved. Contact support if you believe this is a mistake.",
  },
  SUSPENDED: {
    icon: <Ban size={28} className="text-red-400" />,
    title: "Account Suspended",
    text: "Your account has been suspended. Contact support for more information.",
  },
  BLACKLISTED: {
    icon: <Ban size={28} className="text-red-400" />,
    title: "Account Blacklisted",
    text: "Your account has been blacklisted. Contact support for more information.",
  },
};

export function PendingApprovalCard({ status }: PendingApprovalCardProps) {
  const [signingOut, setSigningOut] = useState(false);
  const copy = STATUS_COPY[status || "PENDING"] || STATUS_COPY.PENDING;

  return (
    <div className="glass border border-[var(--border-color)] rounded-xl p-8 text-center">
      <div className="w-16 h-16 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-full flex items-center justify-center mx-auto mb-6">
        {copy.icon}
      </div>
      <h1 className="text-xl font-black text-[var(--text-primary)] mb-3">{copy.title}</h1>
      <p className="text-[var(--text-muted)] text-sm mb-8 leading-relaxed">{copy.text}</p>
      <button
        onClick={async () => { setSigningOut(true); await signOut({ callbackUrl: "/" }); }}
        disabled={signingOut}
        className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors uppercase tracking-wider text-sm"
      >
        {signingOut ? "Signing out..." : "Sign Out"}
      </button>
    </div>
  );
}
