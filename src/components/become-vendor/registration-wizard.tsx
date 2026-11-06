"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, CircleAlert, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SELLER_AGREEMENT_VERSION } from "@/lib/seller/config";
import {
  EMPTY_DRAFT,
  STEP_IDS,
  firstInvalidStep,
  stepForField,
  submitRegistration,
  validateStep,
  type FieldErrors,
  type RegistrationDraft,
  type RegistrationSuccess,
  type StepId,
} from "@/lib/seller/registration";
import { ctaClass, ctaOutlineDark } from "./styles";
import { AccountStep, BankStep, BusinessStep, DocumentsStep, ProductsStep } from "./wizard-steps";
import { StepRail } from "./wizard-controls";

type Phase = { kind: "editing" } | { kind: "submitting" } | { kind: "done"; data: RegistrationSuccess };
type Banner = { tone: "error" | "warn"; message: string } | null;

const DOC_ERROR_KEYS = ["panDocument", "gstCertificate", "businessProof", "bankProof", "catalogue", "form"];

export function VendorRegistrationWizard() {
  const [draft, setDraft] = useState<RegistrationDraft>(EMPTY_DRAFT);
  const [step, setStep] = useState<StepId>("account");
  const [reached, setReached] = useState(0);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [errorTick, setErrorTick] = useState(0);
  const [phase, setPhase] = useState<Phase>({ kind: "editing" });
  const [banner, setBanner] = useState<Banner>(null);
  const [touched, setTouched] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);
  const headingRef = useRef<HTMLDivElement>(null);
  const stepIndex = STEP_IDS.indexOf(step);
  const isLast = stepIndex === STEP_IDS.length - 1;
  const busy = phase.kind === "submitting";

  const set = useCallback(<K extends keyof RegistrationDraft>(key: K, value: RegistrationDraft[K]) => {
    setTouched(true);
    setDraft((d) => ({ ...d, [key]: value }));
    setErrors((e) => {
      const clear = key === "files" ? DOC_ERROR_KEYS : [key as string];
      if (!clear.some((k) => k in e)) return e;
      const next = { ...e };
      for (const k of clear) delete next[k];
      return next;
    });
  }, []);

  // Never keep sensitive data in web storage; the only protection against losing it is a leave warning.
  useEffect(() => {
    if (!touched || phase.kind === "done") return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [touched, phase.kind]);

  // After validation fails, move focus to the first invalid control.
  useEffect(() => {
    if (!errorTick) return;
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"], [data-invalid="true"] input')?.focus();
  }, [errorTick]);

  const moveTo = (next: StepId) => {
    setStep(next);
    setBanner(null);
    // The new step's title takes focus so keyboard / screen-reader users land at its start.
    requestAnimationFrame(() => {
      const title = formRef.current?.querySelector<HTMLElement>("[data-step-title]");
      if (title) {
        title.tabIndex = -1;
        title.focus({ preventScroll: true });
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        title.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
      }
    });
  };

  const showErrors = (errs: FieldErrors, message?: string) => {
    setErrors(errs);
    setErrorTick((n) => n + 1);
    const n = Object.keys(errs).length;
    setBanner({ tone: "error", message: message ?? `Please fix ${n} ${n === 1 ? "field" : "fields"} below to continue.` });
  };

  const next = () => {
    const errs = validateStep(step, draft);
    if (Object.keys(errs).length) return showErrors(errs);
    setErrors({});
    setReached((r) => Math.max(r, stepIndex + 1));
    moveTo(STEP_IDS[stepIndex + 1]);
  };

  const back = () => stepIndex > 0 && moveTo(STEP_IDS[stepIndex - 1]);

  const goto = (s: StepId) => {
    if (STEP_IDS.indexOf(s) <= reached) moveTo(s);
  };

  const submit = async () => {
    // Final gate: every step again, in order, so a stale earlier step can never slip through.
    const bad = firstInvalidStep(draft);
    if (bad) {
      moveTo(bad.step);
      return showErrors(bad.errors, "Some details need attention before you can submit.");
    }
    setBanner(null);
    setErrors({});
    setPhase({ kind: "submitting" });

    const result = await submitRegistration(draft, SELLER_AGREEMENT_VERSION);
    if (result.ok) {
      setPhase({ kind: "done", data: result.data });
      setDraft((d) => ({ ...EMPTY_DRAFT, email: d.email })); // drop password, bank and PAN from memory
      requestAnimationFrame(() => headingRef.current?.focus());
      return;
    }

    setPhase({ kind: "editing" });
    if (result.kind === "validation" && Object.keys(result.fieldErrors).length) {
      const first = Object.keys(result.fieldErrors)[0];
      moveTo(stepForField(first));
      return showErrors(result.fieldErrors, result.message);
    }
    if (result.kind === "conflict") {
      // Email / mobile already registered: it belongs to the account step.
      const field = /mobile/i.test(result.message) ? "mobile" : "email";
      moveTo("account");
      return showErrors({ [field]: result.message }, result.message);
    }
    const wait = result.kind === "rate_limited" && result.retryAfterSeconds ? ` Try again in about ${Math.ceil(result.retryAfterSeconds / 60)} min.` : "";
    setBanner({ tone: result.kind === "unavailable" ? "warn" : "error", message: result.message + wait });
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (isLast) void submit();
    else next();
  };

  // ───────── success ─────────
  if (phase.kind === "done") {
    return (
      <div className="border border-black/15 bg-white p-6 sm:p-10">
        <div ref={headingRef} tabIndex={-1} className="outline-none">
          <CheckCircle2 aria-hidden className="size-9 text-[#166534]" />
          <h3 className="mt-4 font-grotesk text-[28px] font-semibold tracking-[-0.02em] text-mx-black">Application received</h3>
          <p className="mt-2 max-w-[58ch] text-[16px] leading-relaxed text-[#4b4b52]">
            We&apos;ve sent verification codes to your email and mobile. Verify both to move your application into review.
          </p>
        </div>
        <ol className="mt-6 grid gap-0 border-t border-black/15">
          {["Verify your email address", "Verify your mobile number", "MotoXPlus reviews your business and documents", "Once approved, you can list products"].map((t, i) => (
            <li key={t} className="flex items-center gap-4 border-b border-black/15 py-3 text-[15px] text-mx-black">
              <span className="grid size-6 place-items-center bg-mx-black font-grotesk text-[12px] font-semibold text-white">{i + 1}</span>
              {t}
            </li>
          ))}
        </ol>
        <Button asChild size="lg" className={`${ctaClass} mt-8`}>
          <a href={`/verify-email?userId=${encodeURIComponent(phase.data.userId)}`}>
            Verify email <ArrowRight aria-hidden />
          </a>
        </Button>
      </div>
    );
  }

  // ───────── editing ─────────
  const props = { draft, errors, set, disabled: busy };

  return (
    <div className="grid gap-8 bp-lg:grid-cols-[240px_minmax(0,1fr)] bp-lg:gap-14">
      <StepRail current={step} reached={reached} onGo={goto} />

      <form ref={formRef} noValidate onSubmit={onSubmit} aria-busy={busy} className="min-w-0 border border-black/15 bg-white p-5 sm:p-8">
        {banner && (
          <div
            role="alert"
            className={
              "mb-6 flex items-start gap-3 border px-4 py-3 text-[14px] leading-snug " +
              (banner.tone === "warn"
                ? "border-[var(--sig-warn-bd)] bg-[var(--sig-warn-bg)] text-[var(--sig-warn-fg)]"
                : "border-[var(--sig-danger-bd)] bg-[var(--sig-danger-bg)] text-[var(--sig-danger-fg)]")
            }
          >
            <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span>{banner.message}</span>
          </div>
        )}

        {step === "account" && <AccountStep {...props} />}
        {step === "business" && <BusinessStep {...props} />}
        {step === "products" && <ProductsStep {...props} />}
        {step === "bank" && <BankStep {...props} />}
        {step === "documents" && <DocumentsStep {...props} onGo={goto} />}

        <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-black/15 pt-6">
          {stepIndex > 0 ? (
            <Button type="button" variant="ghost" className={ctaOutlineDark} onClick={back} disabled={busy}>
              <ArrowLeft aria-hidden /> Back
            </Button>
          ) : (
            <span />
          )}
          {isLast ? (
            <Button type="submit" size="lg" className={ctaClass} loading={busy}>
              {busy ? "Submitting…" : <>Submit application <Send aria-hidden /></>}
            </Button>
          ) : (
            <Button type="submit" size="lg" className={ctaClass}>
              Continue <ArrowRight aria-hidden />
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
