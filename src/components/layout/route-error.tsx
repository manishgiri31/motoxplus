"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface RouteErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
  /** Where "Go back" leads: the portal's own home, not the marketing site. */
  homeHref: string;
  homeLabel: string;
  scope: string;
}

/**
 * Body of each portal's error.tsx. Rendered inside the portal layout, so the
 * sidebar stays and the user can move on to another page. The digest is the
 * id Next.js prints next to the real error in the server log (pm2 logs),
 * which makes a screenshot of this screen enough to find the cause.
 */
export function RouteError({ error, reset, homeHref, homeLabel, scope }: RouteErrorProps) {
  useEffect(() => {
    console.error(`[${scope} error boundary]`, error);
  }, [error, scope]);

  return (
    <div className="flex min-h-[60vh] flex-col items-start justify-center gap-4 px-2 py-16 sm:items-center sm:text-center">
      <h1 className="font-display text-xl font-semibold text-[var(--ink)]">This page didn&apos;t load</h1>
      <p className="max-w-md text-14 text-[var(--muted)]">
        Something failed on our side. Nothing in your account was changed. Try again, or open another page.
      </p>
      <div className="mt-2 flex gap-3">
        <Button variant="brand" onClick={() => reset()}>Try again</Button>
        <Button asChild variant="ghost">
          <Link href={homeHref}>{homeLabel}</Link>
        </Button>
      </div>
      {error.digest && (
        <p className="mt-4 font-mono text-12 text-[var(--muted)]">Reference: {error.digest}</p>
      )}
    </div>
  );
}
