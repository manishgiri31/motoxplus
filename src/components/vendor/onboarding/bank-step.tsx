"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Field, FormGrid, Input } from "@/components/ui/field";
import { ACCOUNT_NUMBER_REGEX, IFSC_REGEX } from "@/lib/seller/registration";
import { saveBank, type VendorApplication } from "@/lib/vendor/onboarding";
import { errorsFrom, useApplication } from "./application-context";
import { Banner, StepActions, StepPage } from "./step-page";

export function BankStep() {
  return (
    <StepPage
      title="Bank account for payouts"
      description="Settlements for your sales are paid to this account. It must be in the business's name or the owner's name, and match the cancelled cheque you upload next."
      backHref="/vendor/onboarding/categories"
    >
      {(app) => <BankForm app={app} />}
    </StepPage>
  );
}

function BankForm({ app }: { app: VendorApplication }) {
  const router = useRouter();
  const { set } = useApplication();
  const saved = app.bank;
  const [v, setV] = React.useState({
    accountHolder: saved?.accountHolder ?? app.business?.businessName ?? "",
    bankName: saved?.bankName ?? "",
    ifsc: saved?.ifsc ?? "",
    accountNumber: "",
    confirmAccountNumber: "",
  });
  // A saved number is never sent back to the browser; keep it unless the vendor types a new one.
  const [changing, setChanging] = React.useState(!saved);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [banner, setBanner] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const locked = !app.editable;

  const on = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = k === "ifsc" ? e.target.value.toUpperCase() : k.startsWith("account") && k !== "accountHolder" ? e.target.value.replace(/\D/g, "") : e.target.value;
    setV((s) => ({ ...s, [k]: value }));
    setErrors((er) => ({ ...er, [k]: "" }));
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBanner("");
    const errs: Record<string, string> = {};
    if (v.accountHolder.trim().length < 2) errs.accountHolder = "Account holder name is required";
    if (v.bankName.trim().length < 2) errs.bankName = "Bank name is required";
    if (!IFSC_REGEX.test(v.ifsc.trim())) errs.ifsc = "IFSC looks like HDFC0001234";
    if (changing) {
      if (!ACCOUNT_NUMBER_REGEX.test(v.accountNumber)) errs.accountNumber = "Account number must be 9 to 18 digits";
      else if (v.accountNumber !== v.confirmAccountNumber) errs.confirmAccountNumber = "Account numbers don't match";
    }
    setErrors(errs);
    if (Object.keys(errs).length) return;
    if (!changing && saved) {
      const unchanged =
        v.accountHolder.trim() === saved.accountHolder && v.bankName.trim() === saved.bankName && v.ifsc.trim() === saved.ifsc;
      if (unchanged) {
        router.push("/vendor/onboarding/documents");
        return;
      }
      // Holder/bank/IFSC edits still need the number; the server stores the account as one unit.
      setErrors({ accountNumber: "Re-enter the account number to save these changes" });
      setChanging(true);
      return;
    }
    setBusy(true);
    try {
      set(await saveBank({ accountHolder: v.accountHolder.trim(), bankName: v.bankName.trim(), accountNumber: v.accountNumber, ifsc: v.ifsc.trim() }));
      router.push("/vendor/onboarding/documents");
    } catch (err) {
      const { fields, message } = errorsFrom(err);
      setErrors(fields);
      setBanner(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <fieldset disabled={locked || busy} className="min-w-0">
        {banner && (
          <div className="mb-6">
            <Banner tone="error">{banner}</Banner>
          </div>
        )}
        <FormGrid columns={2}>
          <Field label="Account holder name" name="accountHolder" required error={errors.accountHolder} span={2}>
            <Input value={v.accountHolder} onChange={on("accountHolder")} maxLength={120} autoComplete="off" />
          </Field>
          <Field label="Bank name" name="bankName" required error={errors.bankName}>
            <Input value={v.bankName} onChange={on("bankName")} maxLength={100} />
          </Field>
          <Field label="IFSC" name="ifsc" required error={errors.ifsc}>
            <Input value={v.ifsc} onChange={on("ifsc")} maxLength={11} autoCapitalize="characters" spellCheck={false} className="font-mono uppercase" />
          </Field>
          {changing ? (
            <>
              <Field label="Account number" name="accountNumber" required error={errors.accountNumber}>
                <Input value={v.accountNumber} onChange={on("accountNumber")} inputMode="numeric" maxLength={18} autoComplete="off" className="font-mono" />
              </Field>
              <Field label="Confirm account number" name="confirmAccountNumber" required error={errors.confirmAccountNumber}>
                <Input
                  value={v.confirmAccountNumber}
                  onChange={on("confirmAccountNumber")}
                  inputMode="numeric"
                  maxLength={18}
                  autoComplete="off"
                  onPaste={(e) => e.preventDefault()}
                  className="font-mono"
                />
              </Field>
            </>
          ) : (
            <div className="md:col-span-2">
              <p className="text-xs font-semibold text-[var(--text-secondary)]">Account number</p>
              <div className="mt-1.5 flex items-center justify-between gap-4 rounded-lg bg-[var(--card)] px-4 py-3">
                <span className="font-mono text-[15px] tracking-wider">•••• •••• {saved?.accountNumberLast4}</span>
                {!locked && (
                  <button type="button" onClick={() => setChanging(true)} className="text-sm font-semibold text-[var(--accent-text)] hover:underline">
                    Change
                  </button>
                )}
              </div>
            </div>
          )}
        </FormGrid>
        <p className="mt-6 text-xs leading-relaxed text-[var(--muted)]">
          Stored encrypted. Only the last four digits are shown here. MotoXPlus staff can open the full number to pay you, and
          every time they do is recorded.
        </p>
      </fieldset>
      {!locked && <StepActions backHref="/vendor/onboarding/categories" busy={busy} />}
    </form>
  );
}
