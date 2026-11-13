"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getApplication, ONBOARDING_STEPS, stepDone, type VendorApplication } from "@/lib/vendor/onboarding";

/**
 * Vendors are approved at registration (like dealers), so the dashboard opens before the business profile is done.
 * Until it is, selling is locked server-side; this tells the vendor what is left and links straight to it.
 * Renders nothing while loading, on error, or once the profile is complete.
 */
export function ProfileSetupBanner() {
  const [app, setApp] = React.useState<VendorApplication | null>(null);

  React.useEffect(() => {
    let live = true;
    getApplication().then(
      (a) => live && setApp(a),
      () => undefined
    );
    return () => {
      live = false;
    };
  }, []);

  if (!app || app.profileComplete || !app.editable) return null;

  const steps = ONBOARDING_STEPS.filter((s) => s.id !== "review");
  const done = steps.filter((s) => stepDone(app, s.id)).length;
  const next = steps.find((s) => !stepDone(app, s.id));

  return (
    <section
      aria-labelledby="profile-setup-title"
      className="mb-8 border border-[var(--border-color)] border-l-4 border-l-[var(--red)] bg-[var(--bg-card)] px-5 py-5 sm:flex sm:items-center sm:justify-between sm:gap-6"
    >
      <div>
        <h2 id="profile-setup-title" className="text-base font-bold text-[var(--text-primary)]">
          Finish your business profile to start selling
        </h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          {done} of {steps.length} done{next ? ` · next: ${next.label.toLowerCase()}` : " · confirm and you're live"}. Your products can go live
          once your business details, bank account and documents are in.
        </p>
        <div className="mt-3 h-1 w-full max-w-xs bg-[var(--border-color)]" aria-hidden>
          <div className="h-full bg-[var(--red)]" style={{ width: `${(done / steps.length) * 100}%` }} />
        </div>
      </div>
      <Link
        href={next?.href ?? "/vendor/onboarding/review"}
        className="mt-4 inline-flex shrink-0 items-center gap-2 bg-[var(--red)] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 sm:mt-0"
      >
        {done === 0 ? "Start profile" : next ? "Continue" : "Review and confirm"} <ArrowRight aria-hidden className="size-4" />
      </Link>
    </section>
  );
}
