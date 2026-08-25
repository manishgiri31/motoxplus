"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * Route-group-scoped boundary: catches errors thrown by any (public) page
 * (e.g. /products when the DB is unreachable) without falling back to the
 * root error.tsx, which sits above (public)/layout.tsx and would drop the
 * Navbar/Footer chrome — stranding the visitor on a bare page mid-catalog.
 */
export default function PublicErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Public Error Boundary]", error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <h1 className="font-display text-xl font-bold text-[var(--ink)]">This page couldn&apos;t load</h1>
      <p className="max-w-md text-sm text-[var(--muted)]">
        We&apos;re having trouble reaching our catalog right now. Try again in a moment,
        or head back to the homepage.
      </p>
      <div className="flex gap-3 mt-2">
        <Button variant="brand" onClick={() => reset()}>Try again</Button>
        <Button asChild variant="ghost">
          <Link href="/">Go home</Link>
        </Button>
      </div>
    </div>
  );
}
