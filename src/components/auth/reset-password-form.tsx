"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, CheckCircle } from "lucide-react";
import Link from "next/link";

export function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const userId = params.get("userId") || "";
  const resetToken = params.get("token") || "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setErrorMsg("Passwords do not match");
      setStatus("error");
      return;
    }

    if (newPassword.length < 8) {
      setErrorMsg("Password must be at least 8 characters");
      setStatus("error");
      return;
    }

    setStatus("loading");
    setErrorMsg("");

    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, resetToken, newPassword }),
    });
    const data = await res.json();

    if (!res.ok) {
      setErrorMsg(data.error || "Password reset failed");
      setStatus("error");
      return;
    }

    setStatus("success");
    setTimeout(() => router.push("/login?reset=1"), 2000);
  };

  if (!userId || !resetToken) {
    return (
      <div className="glass border border-[var(--border-color)] rounded-sm p-8 text-center">
        <p className="text-red-400 mb-4">Invalid or expired reset link.</p>
        <Link href="/forgot-password" className="text-red-400 hover:text-red-300 font-semibold">
          Request a new OTP
        </Link>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="glass border border-[var(--border-color)] rounded-sm p-8 text-center">
        <CheckCircle className="mx-auto mb-4 text-green-500" size={48} />
        <h2 className="text-2xl font-black text-[var(--text-primary)] mb-2">Password Reset!</h2>
        <p className="text-[var(--text-muted)] text-sm">Redirecting to login...</p>
      </div>
    );
  }

  const strengthScore = [
    newPassword.length >= 8,
    /[A-Z]/.test(newPassword),
    /[a-z]/.test(newPassword),
    /\d/.test(newPassword),
    /[^A-Za-z0-9]/.test(newPassword),
  ].filter(Boolean).length;

  const strengthLabel = ["", "Weak", "Fair", "Good", "Strong", "Very Strong"][strengthScore];
  const strengthColor = ["", "bg-red-600", "bg-orange-500", "bg-yellow-500", "bg-green-500", "bg-green-400"][strengthScore];

  return (
    <div className="glass border border-[var(--border-color)] rounded-sm p-8">
      <h1 className="text-2xl font-black text-[var(--text-primary)] mb-2">Create New Password</h1>
      <p className="text-[var(--text-muted)] text-sm mb-8">Your new password must be at least 8 characters.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider block mb-2">New Password</label>
          <div className="relative">
            <input
              required
              type={showPassword ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Min 8 characters"
              className="w-full themed-input border focus:border-red-600/60 rounded-sm px-4 py-3 text-sm outline-none transition-colors pr-12"
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {newPassword && (
            <div className="mt-2 space-y-1">
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= strengthScore ? strengthColor : "bg-[var(--border-color)]"}`} />
                ))}
              </div>
              <p className="text-xs text-[var(--text-muted)]">Strength: <span className="text-[var(--text-secondary)]">{strengthLabel}</span></p>
            </div>
          )}
        </div>

        <div>
          <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider block mb-2">Confirm Password</label>
          <input
            required
            type={showPassword ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Repeat your password"
            className="w-full themed-input border focus:border-red-600/60 rounded-sm px-4 py-3 text-sm outline-none transition-colors"
          />
        </div>

        {status === "error" && (
          <div className="bg-red-900/20 border border-red-900/40 rounded-sm px-4 py-3 text-red-400 text-sm">{errorMsg}</div>
        )}

        <button
          type="submit"
          disabled={!newPassword || !confirmPassword || status === "loading"}
          className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold py-4 rounded-sm transition-colors uppercase tracking-wider text-sm"
        >
          {status === "loading" ? "Resetting..." : "Reset Password"}
        </button>
      </form>
    </div>
  );
}
