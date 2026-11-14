"use client";

import Link from "next/link";
import { ArrowLeft, CircleAlert, Lock, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { VendorApplication } from "@/lib/vendor/onboarding";
import { useApplication } from "./application-context";

/** White panel used by every onboarding page. */
export function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-2xl bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)] md:p-10 ${className}`}>{children}</section>;
}

export function Banner({ tone, children }: { tone: "error" | "info"; children: React.ReactNode }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={
        tone === "error"
          ? "flex items-start gap-3 rounded-xl border border-[var(--sig-danger-bd)] bg-[var(--sig-danger-bg)] px-4 py-3 text-sm text-[var(--sig-danger-fg)]"
          : "flex items-start gap-3 rounded-xl bg-[var(--card)] px-4 py-3 text-sm text-[var(--ink)]"
      }
    >
      {tone === "error" ? <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" /> : <Lock aria-hidden className="mt-0.5 size-4 shrink-0" />}
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/**
 * Loads the application (shared context) and renders one step: heading, optional notices, the step's own form,
 * and a footer with Back + the primary action. The form itself is supplied by the step module via `children`.
 */
export function StepPage({
  title,
  description,
  backHref,
  writable,
  children,
}: {
  title: string;
  description: string;
  backHref?: string;
  /** Whether this page can still be changed; defaults to the application being editable. */
  writable?: (app: VendorApplication) => boolean;
  children: (app: VendorApplication) => React.ReactNode;
}) {
  const { status, reload } = useApplication();

  if (status.kind === "loading") {
    return (
      <Panel>
        <div className="h-7 w-56 animate-pulse rounded bg-[var(--card)]" />
        <div className="mt-4 h-4 w-80 max-w-full animate-pulse rounded bg-[var(--card)]" />
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-[var(--card)]" />
          ))}
        </div>
      </Panel>
    );
  }
  if (status.kind === "error") {
    return (
      <Panel>
        <Banner tone="error">
          {status.message}{" "}
          <button type="button" onClick={reload} className="ml-1 inline-flex items-center gap-1 font-semibold underline underline-offset-4">
            <RefreshCw aria-hidden className="size-3.5" /> Try again
          </button>
        </Banner>
      </Panel>
    );
  }

  const app = status.app;
  return (
    <Panel>
      <h1 className="text-[clamp(24px,3vw,32px)] font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-[var(--muted)]">{description}</p>
      {!(writable ? writable(app) : app.editable) && (
        <div className="mt-6">
          <Banner tone="info">
            {app.state === "UNDER_REVIEW"
              ? "Your application is under review, so these details are read-only for now."
              : "These details can't be changed at the moment."}{" "}
            <Link href="/vendor/onboarding" className="font-semibold underline underline-offset-4">
              See application status
            </Link>
          </Banner>
        </div>
      )}
      <div className="mt-8">{children(app)}</div>
      {backHref && (
        <div className="mt-8 border-t border-[var(--line)] pt-6 sm:hidden">
          <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--ink)]">
            <ArrowLeft aria-hidden className="size-4" /> Back
          </Link>
        </div>
      )}
    </Panel>
  );
}

/** Footer for a step form: Back (desktop) on the left, the primary action on the right. */
export function StepActions({ backHref, busy, label = "Save and continue", disabled }: { backHref?: string; busy?: boolean; label?: string; disabled?: boolean }) {
  return (
    <div className="mt-10 flex items-center justify-between gap-4 border-t border-[var(--line)] pt-6">
      {backHref ? (
        <Link href={backHref} className="hidden items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--ink)] sm:inline-flex">
          <ArrowLeft aria-hidden className="size-4" /> Back
        </Link>
      ) : (
        <span />
      )}
      <Button type="submit" size="lg" loading={busy} disabled={disabled || busy} className="w-full sm:w-auto">
        {label}
      </Button>
    </div>
  );
}
