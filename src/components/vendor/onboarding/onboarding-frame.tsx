"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { fullLogout } from "@/lib/auth/client-logout";
import { ONBOARDING_STEPS, stepDone } from "@/lib/vendor/onboarding";
import { useApplication } from "./application-context";

/**
 * Chrome for /vendor/onboarding/*: a quiet top bar and a step rail. The rail is navigation only; each step is its
 * own page. On phones the rail collapses to "Step n of 5" with a thin progress bar.
 */
export function OnboardingFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { status } = useApplication();
  const app = status.kind === "ready" ? status.app : null;
  const currentIdx = ONBOARDING_STEPS.findIndex((s) => pathname === s.href);
  const showRail = !app || app.editable || app.state === "UNDER_REVIEW";

  return (
    <div className="mx-seller min-h-screen bg-[var(--card)] font-display text-[var(--ink)]">
      <header className="border-b border-[var(--line)] bg-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 md:px-8">
          <Link href="/" className="text-[15px] font-black tracking-[0.12em] focus-visible:outline-2 focus-visible:outline-offset-4">
            MOTOX<span className="text-[var(--red)]">PLUS</span>
          </Link>
          <div className="flex items-center gap-5 text-sm">
            <Link href="/vendor/onboarding" className="hidden text-[var(--muted)] hover:text-[var(--ink)] sm:inline">
              Vendor setup
            </Link>
            <button
              type="button"
              onClick={() => fullLogout("/become-vendor")}
              className="inline-flex items-center gap-1.5 text-[var(--muted)] hover:text-[var(--ink)]"
            >
              <LogOut aria-hidden className="size-4" /> Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 md:px-8 md:py-12 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-12">
        {showRail && (
          <nav aria-label="Application steps" className="lg:pt-2">
            {/* phones and tablets */}
            <div className="lg:hidden">
              {currentIdx >= 0 ? (
                <p className="text-[13px] font-semibold text-[var(--muted)]">
                  Step {currentIdx + 1} of {ONBOARDING_STEPS.length} <span className="text-[var(--ink)]">· {ONBOARDING_STEPS[currentIdx].label}</span>
                </p>
              ) : (
                <p className="text-[13px] font-semibold text-[var(--muted)]">Vendor setup</p>
              )}
              <div className="mt-2.5 flex gap-1" aria-hidden>
                {ONBOARDING_STEPS.map((s, i) => (
                  <span
                    key={s.id}
                    className={cn("h-1 flex-1 rounded-full", app && stepDone(app, s.id) ? "bg-[var(--red)]" : i === currentIdx ? "bg-[var(--ink)]" : "bg-[var(--line)]")}
                  />
                ))}
              </div>
            </div>

            {/* desktop rail */}
            <ol className="hidden space-y-1 lg:block">
              {ONBOARDING_STEPS.map((s, i) => {
                const done = !!app && stepDone(app, s.id);
                const active = i === currentIdx;
                return (
                  <li key={s.id}>
                    <Link
                      href={s.href}
                      aria-current={active ? "step" : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] transition-colors",
                        active ? "bg-white font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.06)]" : "text-[var(--muted)] hover:text-[var(--ink)]"
                      )}
                    >
                      <span
                        className={cn(
                          "grid size-6 shrink-0 place-items-center rounded-full border text-[12px] font-semibold tabular-nums",
                          done ? "border-[var(--red)] bg-[var(--red)] text-white" : active ? "border-[var(--ink)] text-[var(--ink)]" : "border-[var(--line)]"
                        )}
                      >
                        {done ? <Check aria-hidden className="size-3.5" strokeWidth={3} /> : i + 1}
                      </span>
                      {s.label}
                      {done && <span className="sr-only">(complete)</span>}
                    </Link>
                  </li>
                );
              })}
            </ol>
          </nav>
        )}

        <main id="main" className={cn("min-w-0", !showRail && "lg:col-span-2")}>
          {children}
        </main>
      </div>
    </div>
  );
}
