"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { LoginForm } from "./login-form";
import { CustomerAuthForm } from "./customer-auth-form";
import { AuthTabs } from "./auth-ui";

type Mode = "trade" | "customer";

// Login page's entry switch — B2C-EXPANSION-PLAN.md Phase 2: "do raaste" for
// signing in, trade (dealer/vendor/staff — password or code) vs. customer
// (phone-OTP only, see CustomerAuthForm). `?as=customer` deep-links straight
// into the customer tab (e.g. from a product page's "Sign in to order" CTA).
export function LoginModeSwitch() {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>(searchParams.get("as") === "customer" ? "customer" : "trade");

  return (
    <div>
      <AuthTabs
        label="Account type"
        value={mode}
        onChange={setMode}
        tabs={[
          { id: "trade", label: "Trade account" },
          { id: "customer", label: "Customer" },
        ]}
      />
      <div role="tabpanel" id={`panel-${mode}`} aria-labelledby={`tab-${mode}`}>
        {mode === "trade" ? <LoginForm /> : <CustomerAuthForm />}
      </div>
    </div>
  );
}
