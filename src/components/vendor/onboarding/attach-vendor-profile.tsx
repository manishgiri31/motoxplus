"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { AuthAlert, AuthHeading } from "@/components/auth/auth-ui";
import { ApiError, NetworkError, apiFetch } from "@/lib/api/client";

/**
 * /become-vendor/register for someone already signed in as a dealer or customer: no second account. The vendor
 * profile is added to this login (Java POST /api/v1/vendors/attach), the workspace switches to VENDOR, and the
 * business-profile steps open. Email, mobile and password stay exactly as they are.
 */
export function AttachVendorProfile({ email, workspaceLabel }: { email: string; workspaceLabel: string }) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");

  async function start() {
    setBusy(true);
    setError("");
    try {
      await apiFetch<{ vendorId: string }>("/vendors/attach", { method: "POST" });
      const res = await fetch("/api/auth/switch-workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace: "VENDOR" }),
      });
      const body = (await res.json().catch(() => ({}))) as { redirectTo?: string; error?: string };
      if (!res.ok) throw new Error(body.error || "Your vendor profile was added, but we couldn't open it. Use “Switch to Vendor” in your dashboard.");
      window.location.assign("/vendor/onboarding");
    } catch (e) {
      setBusy(false);
      if (e instanceof ApiError && [404, 501, 502, 503, 504].includes(e.status)) {
        setError("Vendor registration isn't available right now. Nothing was changed; please try again shortly.");
      } else if (e instanceof NetworkError) {
        setError("We couldn't reach the server. Check your connection and try again.");
      } else {
        setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
      }
    }
  }

  return (
    <div>
      <AuthHeading
        title="Start selling with this account"
        subtitle={
          <>
            You&apos;re signed in as <span className="font-medium text-[var(--ink)]">{email}</span>. We&apos;ll add a vendor profile to the same
            login: same email, mobile and password. Your {workspaceLabel.toLowerCase()} account, orders and invoices stay as they are.
          </>
        }
      />
      {error && <AuthAlert className="mb-5">{error}</AuthAlert>}
      <ul className="mb-6 space-y-2 text-[15px] text-[var(--muted)]">
        <li>· Approved straight away; your email and mobile are already verified.</li>
        <li>· Next: business details, bank account and documents, then you can list products.</li>
        <li>· Switch between {workspaceLabel} and Vendor any time from the sidebar.</li>
      </ul>
      <Button size="lg" block loading={busy} disabled={busy} onClick={start}>
        Add vendor profile
      </Button>
    </div>
  );
}
