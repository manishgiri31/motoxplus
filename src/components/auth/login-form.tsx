"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dealer/dashboard";

  const [formData, setFormData] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");

    const result = await signIn("credentials", {
      email: formData.email,
      password: formData.password,
      redirect: false,
    });

    if (result?.error) {
      setErrorMsg(result.error);
      setStatus("error");
      return;
    }

    // Redirect based on role (will be handled by middleware)
    router.push(callbackUrl);
    router.refresh();
  };

  return (
    <div className="glass border border-[var(--border-color)] rounded-sm p-8">
      <h1 className="text-2xl font-black text-[var(--text-primary)] mb-2">Welcome Back</h1>
      <p className="text-[var(--text-muted)] text-sm mb-8">Sign in to your dealer or admin account.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider block mb-2">
            Email Address
          </label>
          <input
            type="email"
            required
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="w-full themed-input border focus:border-red-600/60 rounded-sm px-4 py-3 text-sm outline-none transition-colors"
            placeholder="you@company.com"
            autoComplete="email"
          />
        </div>

        <div>
          <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider block mb-2">
            Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              required
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full themed-input border focus:border-red-600/60 rounded-sm px-4 py-3 text-sm outline-none transition-colors pr-12"
              placeholder="Your password"
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {status === "error" && (
          <div className="bg-red-900/20 border border-red-900/40 rounded-sm px-4 py-3 text-red-400 text-sm">
            {errorMsg}
          </div>
        )}

        <button
          type="submit"
          disabled={status === "loading"}
          className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold py-4 rounded-sm transition-colors uppercase tracking-wider text-sm"
        >
          {status === "loading" ? "Signing in..." : "Sign In"}
        </button>
      </form>

      <div className="mt-6 pt-6 border-t border-[var(--border-color)] text-center">
        <p className="text-[var(--text-muted)] text-sm mb-4">
          Not a dealer yet?{" "}
          <Link href="/become-dealer" className="text-red-400 hover:text-red-300 font-semibold">
            Apply Now
          </Link>
        </p>
        <Link href="/" className="text-gray-600 hover:text-[var(--text-muted)] text-xs transition-colors">
          ← Back to website
        </Link>
      </div>

      {/* Role hints */}
      <div className="mt-6 glass border border-[var(--border-color)] rounded-sm p-4">
        <div className="text-gray-600 text-xs uppercase tracking-widest mb-3">Portal Access</div>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-[var(--text-muted)]">Dealers</span>
            <span className="text-[var(--text-muted)]">Dashboard → Orders → Invoices</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--text-muted)]">Admins</span>
            <span className="text-[var(--text-muted)]">Manage Products → Dealers → Orders</span>
          </div>
        </div>
      </div>
    </div>
  );
}
