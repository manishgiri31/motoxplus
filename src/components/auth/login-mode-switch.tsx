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
      <div className="grid grid-cols-2 gap-1 mb-5 p-1 rounded-pill bg-[var(--surface-3)]">
        <button
          type="button"
          onClick={() => setMode("dealer")}
          className={`py-2.5 text-14 rounded-pill transition-colors duration-[var(--dur-2)] ${
            mode === "dealer" ? "bg-white text-[var(--ink)] shadow-s1 font-semibold" : "text-[var(--muted)] hover:text-[var(--ink)]"
          }`}
        >
          Dealer
        </button>
        <button
          type="button"
          onClick={() => setMode("customer")}
          className={`py-2.5 text-14 rounded-pill transition-colors duration-[var(--dur-2)] ${
            mode === "customer" ? "bg-white text-[var(--ink)] shadow-s1 font-semibold" : "text-[var(--muted)] hover:text-[var(--ink)]"
          }`}
        >
          Customer
        </button>
      </div>
      {mode === "dealer" ? <LoginForm /> : <CustomerAuthForm />}
    </div>
  );
}
