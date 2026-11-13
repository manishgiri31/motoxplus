"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { ArrowRight, Check, Clock, MessageSquareWarning, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ONBOARDING_STEPS, nextStep, stepDone, type VendorApplication } from "@/lib/vendor/onboarding";
import { useApplication } from "./application-context";
import { Banner, Panel } from "./step-page";

function formatDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

/** /vendor/onboarding: where the application stands, and the one thing to do next. */
export function ApplicationStatus() {
  const { status, reload } = useApplication();
  const { data: session } = useSession();
  if (status.kind === "loading") {
    return (
      <Panel>
        <div className="h-8 w-72 max-w-full animate-pulse rounded bg-[var(--card)]" />
        <div className="mt-8 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
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
          <button type="button" onClick={reload} className="font-semibold underline underline-offset-4">
            Try again
          </button>
        </Banner>
      </Panel>
    );
  }

  const app = status.app;
  switch (app.state) {
    case "UNDER_REVIEW":
      return <UnderReview app={app} />;
    case "ACTIVE":
      // Auto-approved at registration: the account works, the business profile is still to finish.
      if (!app.profileComplete) return <Checklist app={app} />;
      return (
        <Outcome icon={<Check aria-hidden className="size-6" />} title="Your vendor account is active">
          <p>Your business profile is complete. You can add products from your dashboard.</p>
          <Button asChild size="lg" className="mt-6">
            <Link href="/vendor/dashboard">Open vendor dashboard</Link>
          </Button>
        </Outcome>
      );
    case "REJECTED":
      return (
        <Outcome icon={<ShieldAlert aria-hidden className="size-6" />} title="Your application was not approved" tone="danger">
          {app.decision?.reason && <Reason text={app.decision.reason} />}
          <p className="mt-4">If you think this is a mistake, write to info@motoxplus.com with your vendor code {app.vendorCode}.</p>
        </Outcome>
      );
    case "SUSPENDED":
      return (
        <Outcome icon={<ShieldAlert aria-hidden className="size-6" />} title="Your vendor account is suspended" tone="danger">
          <p>Your products are hidden and you can&apos;t take new orders until MotoXPlus reactivates the account. Write to info@motoxplus.com with your vendor code {app.vendorCode}.</p>
        </Outcome>
      );
    case "BLOCKED":
      return (
        <Outcome icon={<ShieldAlert aria-hidden className="size-6" />} title="This vendor account is closed" tone="danger">
          <p>Write to info@motoxplus.com if you need more information.</p>
        </Outcome>
      );
    case "PENDING_VERIFICATION":
      return (
        <Outcome icon={<Clock aria-hidden className="size-6" />} title="Verify your contact details first">
          <p>We need to confirm your email address and mobile number before you can add business details.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            {!app.account.emailVerified && (
              <Button asChild size="lg">
                <Link href={`/verify-email?userId=${encodeURIComponent(session?.user?.id ?? "")}`}>Verify email</Link>
              </Button>
            )}
            {app.account.emailVerified && !app.account.mobileVerified && (
              <Button asChild size="lg">
                <Link href="/verify-mobile">Verify mobile</Link>
              </Button>
            )}
          </div>
        </Outcome>
      );
    default:
      return <Checklist app={app} />;
  }
}

function Checklist({ app }: { app: VendorApplication }) {
  const next = nextStep(app);
  const doneCount = ONBOARDING_STEPS.filter((s) => s.id !== "review" && stepDone(app, s.id)).length;
  const ready = doneCount === ONBOARDING_STEPS.length - 1;
  const changes = app.decision?.decision === "CHANGES_REQUESTED";
  const active = app.state === "ACTIVE";

  return (
    <Panel>
      <p className="text-sm font-medium text-[var(--muted)]">Vendor code {app.vendorCode}</p>
      <h1 className="mt-1 text-[clamp(26px,3.4vw,36px)] font-semibold tracking-tight">
        {changes
          ? "Update your application"
          : ready
            ? "Ready to submit"
            : active
              ? "Your vendor account is active"
              : `Welcome, ${app.account.fullName.split(" ")[0]}`}
      </h1>
      <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-[var(--muted)]">
        {ready
          ? active
            ? "Everything is filled in. Confirm it once to start listing products."
            : "Everything is filled in. Review it once and submit it for approval."
          : active
            ? "Finish your business profile to start selling: five short steps, saved as you go. Your dashboard is already open."
            : "Five short steps. Your progress is saved after each one, so you can stop and come back any time."}
      </p>

      {changes && app.decision?.reason && (
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-[var(--accent-soft-border)] bg-[var(--accent-soft)] px-4 py-3.5">
          <MessageSquareWarning aria-hidden className="mt-0.5 size-5 shrink-0 text-[var(--accent-text)]" />
          <div className="text-[15px]">
            <p className="font-semibold">Our reviewer asked for changes</p>
            <p className="mt-1 whitespace-pre-line">{app.decision.reason}</p>
          </div>
        </div>
      )}

      <ol className="mt-8 divide-y divide-[var(--line)] border-y border-[var(--line)]">
        {ONBOARDING_STEPS.map((s, i) => {
          const done = stepDone(app, s.id);
          const isNext = s.id === next.id;
          return (
            <li key={s.id}>
              <Link href={s.href} className="group flex items-center gap-4 py-4">
                <span
                  className={cn(
                    "grid size-8 shrink-0 place-items-center rounded-full border text-[13px] font-semibold tabular-nums",
                    done ? "border-[var(--red)] bg-[var(--red)] text-white" : isNext ? "border-[var(--ink)]" : "border-[var(--line)] text-[var(--muted)]"
                  )}
                >
                  {done ? <Check aria-hidden className="size-4" strokeWidth={3} /> : i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn("block text-[15px]", done || isNext ? "font-semibold" : "text-[var(--muted)]")}>{s.label}</span>
                  {s.id === "documents" && !done && app.missingDocuments.length > 0 && (
                    <span className="block text-sm text-[var(--muted)]">{app.missingDocuments.length} required still to upload</span>
                  )}
                </span>
                <span className="text-sm text-[var(--muted)] group-hover:text-[var(--ink)]">{done ? "Edit" : isNext ? "Start" : ""}</span>
              </Link>
            </li>
          );
        })}
      </ol>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button asChild size="lg" iconRight={<ArrowRight aria-hidden />} className="w-full sm:w-auto">
          <Link href={next.href}>{ready ? "Review and submit" : doneCount === 0 ? `Start with ${next.label.toLowerCase()}` : `Continue: ${next.label}`}</Link>
        </Button>
        {active && (
          <Link href="/vendor/dashboard" className="text-center text-sm font-medium text-[var(--muted)] underline-offset-4 hover:text-[var(--ink)] hover:underline">
            Go to dashboard
          </Link>
        )}
      </div>
    </Panel>
  );
}

function UnderReview({ app }: { app: VendorApplication }) {
  return (
    <Panel>
      <span className="grid size-12 place-items-center rounded-full bg-[var(--card)]">
        <Clock aria-hidden className="size-6" />
      </span>
      <h1 className="mt-6 text-[clamp(26px,3.4vw,36px)] font-semibold tracking-tight">We&apos;re reviewing your application</h1>
      <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-[var(--muted)]">
        Submitted on {formatDate(app.submittedAt)}. A MotoXPlus reviewer checks your business details and documents, usually within 2 business
        days. We&apos;ll email {app.account.email} with the decision.
      </p>
      <ol className="mt-8 space-y-4 text-[15px]">
        <TimelineItem done title="Application submitted" />
        <TimelineItem current title="Document and business review" detail="We may ask you to correct or re-upload something." />
        <TimelineItem title="Account activated" detail="Then you can add products under your approved categories." />
      </ol>
      <p className="mt-8 text-sm text-[var(--muted)]">
        Vendor code <span className="font-mono text-[var(--ink)]">{app.vendorCode}</span>. Questions: info@motoxplus.com
      </p>
    </Panel>
  );
}

function TimelineItem({ title, detail, done, current }: { title: string; detail?: string; done?: boolean; current?: boolean }) {
  return (
    <li className="flex gap-4">
      <span
        className={cn(
          "mt-1 size-3 shrink-0 rounded-full",
          done ? "bg-[var(--red)]" : current ? "bg-[var(--ink)] ring-4 ring-black/10" : "bg-[var(--line)]"
        )}
        aria-hidden
      />
      <span>
        <span className={cn("block", done || current ? "font-semibold" : "text-[var(--muted)]")}>{title}</span>
        {detail && <span className="block text-sm text-[var(--muted)]">{detail}</span>}
      </span>
    </li>
  );
}

function Outcome({ icon, title, tone, children }: { icon: React.ReactNode; title: string; tone?: "danger"; children: React.ReactNode }) {
  return (
    <Panel>
      <span className={cn("grid size-12 place-items-center rounded-full", tone === "danger" ? "bg-[var(--sig-danger-bg)] text-[var(--sig-danger-fg)]" : "bg-[var(--card)]")}>
        {icon}
      </span>
      <h1 className="mt-6 text-[clamp(26px,3.4vw,36px)] font-semibold tracking-tight">{title}</h1>
      <div className="mt-2 max-w-2xl text-[15px] leading-relaxed text-[var(--muted)]">{children}</div>
    </Panel>
  );
}

function Reason({ text }: { text: string }) {
  return (
    <div className="mt-4 rounded-xl bg-[var(--card)] px-4 py-3 text-[var(--ink)]">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Reason</p>
      <p className="mt-1 whitespace-pre-line">{text}</p>
    </div>
  );
}
