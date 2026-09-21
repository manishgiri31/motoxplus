"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { LoginForm } from "./login-form";
import { CustomerAuthForm } from "./customer-auth-form";

type Mode = "dealer" | "customer";

// Login page's entry switch — B2C-EXPANSION-PLAN.md Phase 2: "do raaste" for
// signing in, dealer (existing GSTIN/KYC flow, untouched) vs. customer (new,
// phone-OTP only, see CustomerAuthForm). `?as=customer` deep-links straight
// into the customer tab (e.g. from a product page's "Sign in to order" CTA).
export function LoginModeSwitch() {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>(searchParams.get("as") === "customer" ? "customer" : "dealer");

  return (
    <div>
      <div className="grid grid-cols-2 mb-5 border border-[var(--line)] rounded-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setMode("dealer")}
          className={`py-3 text-xs font-bold uppercase tracking-wider transition-colors ${
            mode === "dealer" ? "bg-[var(--red)] text-white" : "bg-[var(--card)] text-[var(--muted)] hover:text-[var(--ink)]"
          }`}
        >
          Dealer Login
        </button>
        <button
          type="button"
          onClick={() => setMode("customer")}
          className={`py-3 text-xs font-bold uppercase tracking-wider transition-colors ${
            mode === "customer" ? "bg-[var(--red)] text-white" : "bg-[var(--card)] text-[var(--muted)] hover:text-[var(--ink)]"
          }`}
        >
          Customer Login
        </button>
      </div>
      {mode === "dealer" ? <LoginForm /> : <CustomerAuthForm />}
    </div>
  );
}
