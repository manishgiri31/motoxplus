"use client";

import { useState } from "react";
import { CheckCircle2, CircleAlert, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FormGrid, Input, Textarea } from "@/components/ui/field";
import { normalizeIndianMobile } from "@/lib/phone";
import { ctaClass } from "./styles";

/**
 * Shown instead of the wizard while seller registration is not open (NEXT_PUBLIC_SELLER_SIGNUP_OPEN != "true").
 * Posts to the EXISTING /api/contact endpoint (emails the MotoXPlus team), so it is real and working today:
 * no account is created and nothing is stored. Success is shown only after the server answers 2xx.
 */
export function SellerInterestForm() {
  const [v, setV] = useState({ name: "", business: "", phone: "", email: "", supply: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [serverMsg, setServerMsg] = useState("");

  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setV((s) => ({ ...s, [k]: e.target.value }));
    setErrors((er) => ({ ...er, [k]: "" }));
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (v.name.trim().length < 2) errs.name = "Enter your name";
    if (v.business.trim().length < 2) errs.business = "Enter your business name";
    if (!normalizeIndianMobile(v.phone)) errs.phone = "Enter a valid 10-digit Indian mobile number";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim())) errs.email = "Enter a valid email address";
    if (v.supply.trim().length < 5) errs.supply = "Tell us briefly what you supply";
    setErrors(errs);
    if (Object.keys(errs).length) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>("#seller-interest [aria-invalid='true']")?.focus());
      return;
    }

    setState("sending");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: v.name.trim(),
          email: v.email.trim(),
          phone: normalizeIndianMobile(v.phone),
          subject: "partnership",
          message: `SELLER INTEREST (marketplace vendor)\nBusiness: ${v.business.trim()}\n\nWhat they supply:\n${v.supply.trim()}`,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setServerMsg(typeof body?.error === "string" ? body.error : "We couldn't send your details. Please try again.");
        setState("error");
        return;
      }
      setState("sent");
    } catch {
      setServerMsg("We couldn't reach the server. Check your connection and try again.");
      setState("error");
    }
  }

  if (state === "sent") {
    return (
      <div role="status" className="border border-black/15 bg-white p-8">
        <CheckCircle2 aria-hidden className="size-8 text-[#166534]" />
        <h3 className="mt-3 font-grotesk text-[24px] font-semibold tracking-[-0.02em] text-mx-black">Thank you, we have your details</h3>
        <p className="mt-2 max-w-[56ch] text-[16px] leading-relaxed text-[#4b4b52]">
          The MotoXPlus team has received your interest and will get in touch about onboarding.
        </p>
      </div>
    );
  }

  return (
    <form id="seller-interest" noValidate onSubmit={submit} aria-busy={state === "sending"} className="border border-black/15 bg-white p-5 sm:p-8">
      <h3 className="font-grotesk text-[24px] font-semibold tracking-[-0.02em] text-mx-black">Seller registration is opening soon</h3>
      <p className="mt-1.5 max-w-[60ch] text-[15px] leading-relaxed text-[#4b4b52]">
        We are finishing the seller onboarding system. Leave your details and the MotoXPlus team will contact you about getting started.
      </p>

      {state === "error" && (
        <div role="alert" className="mt-5 flex items-start gap-3 border border-[var(--sig-danger-bd)] bg-[var(--sig-danger-bg)] px-4 py-3 text-[14px] text-[var(--sig-danger-fg)]">
          <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          {serverMsg}
        </div>
      )}

      <div className="mt-6">
        <FormGrid>
          <Field label="Your name" name="name" required error={errors.name}>
            <Input value={v.name} autoComplete="name" maxLength={100} onChange={set("name")} />
          </Field>
          <Field label="Business name" name="business" required error={errors.business}>
            <Input value={v.business} autoComplete="organization" maxLength={150} onChange={set("business")} />
          </Field>
          <Field label="Mobile number" name="phone" required error={errors.phone}>
            <Input type="tel" inputMode="tel" value={v.phone} autoComplete="tel" maxLength={16} onChange={set("phone")} />
          </Field>
          <Field label="Email address" name="email" required error={errors.email}>
            <Input type="email" value={v.email} autoComplete="email" maxLength={254} onChange={set("email")} />
          </Field>
          <Field label="What do you supply?" name="supply" required error={errors.supply} span={2} hint="Product types, vehicle brands, approximate range.">
            <Textarea value={v.supply} maxLength={1000} onChange={set("supply")} />
          </Field>
        </FormGrid>
      </div>

      <div className="mt-6 flex justify-end border-t border-black/15 pt-6">
        <Button type="submit" size="lg" className={ctaClass} loading={state === "sending"}>
          {state === "sending" ? "Sending…" : <>Notify me <Send aria-hidden /></>}
        </Button>
      </div>
    </form>
  );
}
