"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[App Error Boundary]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center bg-[var(--paper)]">
      <h1 className="font-display text-xl font-bold text-[var(--ink)]">Something went wrong</h1>
      <p className="max-w-md text-sm text-[var(--muted)]">
        We hit an unexpected error loading this page. Your cart and account are safe — try again,
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
