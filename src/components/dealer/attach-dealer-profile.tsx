"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { INDIAN_STATES } from "@/lib/seller/registration";

type Values = { companyName: string; gstNumber: string; state: string; city: string; pincode: string; shopAddress: string };

/**
 * /become-dealer for someone already signed in as a vendor: no second account. Only the shop's details are asked
 * for; the dealer profile is added to this login (POST /api/dealer/register with attach), then the workspace
 * switches to DEALER. `hasDealer` = the profile already exists, so only the switch is offered.
 */
export function AttachDealerProfile({ email, hasDealer }: { email: string; hasDealer: boolean }) {
  const [v, setV] = React.useState<Values>({ companyName: "", gstNumber: "", state: "", city: "", pincode: "", shopAddress: "" });
  const [errors, setErrors] = React.useState<Partial<Record<keyof Values, string>>>({});
  const [banner, setBanner] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const on = (k: keyof Values) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setV((s) => ({ ...s, [k]: k === "gstNumber" ? e.target.value.toUpperCase() : e.target.value }));
    setErrors((er) => ({ ...er, [k]: undefined }));
  };

  async function switchToDealer() {
    const res = await fetch("/api/auth/switch-workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspace: "DEALER" }),
    });
    const body = (await res.json().catch(() => ({}))) as { redirectTo?: string; error?: string };
    if (!res.ok) throw new Error(body.error || "Couldn't open the dealer account. Use “Switch to Dealer” in your vendor dashboard.");
    window.location.assign(body.redirectTo || "/dealer/dashboard");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBanner("");
    if (!hasDealer) {
      const errs: Partial<Record<keyof Values, string>> = {};
      if (v.companyName.trim().length < 2) errs.companyName = "Enter your shop or company name";
      if (!v.state) errs.state = "Select a state";
      if (v.city.trim().length < 2) errs.city = "Enter your city";
      if (v.pincode && !/^[1-9][0-9]{5}$/.test(v.pincode.trim())) errs.pincode = "Enter a 6-digit pincode";
      setErrors(errs);
      if (Object.keys(errs).length) return;
    }

    setBusy(true);
    try {
      if (!hasDealer) {
        const res = await fetch("/api/dealer/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            attach: true,
            companyName: v.companyName.trim(),
            gstNumber: v.gstNumber.trim(),
            state: v.state,
            city: v.city.trim(),
            pincode: v.pincode.trim(),
            shopAddress: v.shopAddress.trim(),
          }),
        });
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) throw new Error(body.error || "Couldn't add the dealer profile. Please try again.");
      }
      await switchToDealer();
    } catch (err) {
      setBanner(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="glass rounded-xl border border-[var(--border-color)] p-6 sm:p-8">
      <h2 className="text-2xl font-black tracking-tight text-[var(--text-primary)]">
        {hasDealer ? "You already have a dealer account" : "Buy at dealer prices with this account"}
      </h2>
      <p className="mt-2 text-[15px] leading-relaxed text-[var(--text-muted)]">
        Signed in as <span className="font-medium text-[var(--text-primary)]">{email}</span>.{" "}
        {hasDealer
          ? "Open it with the same login."
          : "We'll add a dealer profile to the same login: same email, mobile and password. Your vendor account stays as it is."}
      </p>

      {banner && (
        <p role="alert" className="mt-5 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500">
          {banner}
        </p>
      )}

      {!hasDealer && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Field label="Shop / company name" name="companyName" required error={errors.companyName} span={2}>
            <Input value={v.companyName} onChange={on("companyName")} autoComplete="organization" maxLength={120} />
          </Field>
          <Field label="GST number" name="gstNumber" hint="Optional. Needed for GST invoices." error={errors.gstNumber} span={2}>
            <Input value={v.gstNumber} onChange={on("gstNumber")} maxLength={15} />
          </Field>
          <Field label="State" name="state" required error={errors.state}>
            <Select value={v.state} onChange={on("state")}>
              <option value="">Select state</option>
              {INDIAN_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="City" name="city" required error={errors.city}>
            <Input value={v.city} onChange={on("city")} autoComplete="address-level2" maxLength={80} />
          </Field>
          <Field label="Shop address" name="shopAddress" span={2}>
            <Input value={v.shopAddress} onChange={on("shopAddress")} autoComplete="street-address" maxLength={300} />
          </Field>
          <Field label="Pincode" name="pincode" error={errors.pincode}>
            <Input value={v.pincode} onChange={on("pincode")} inputMode="numeric" maxLength={6} />
          </Field>
        </div>
      )}

      <Button type="submit" size="lg" block loading={busy} disabled={busy} className="mt-6">
        {hasDealer ? "Switch to Dealer" : "Add dealer profile"}
      </Button>
    </form>
  );
}
