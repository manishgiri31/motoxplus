"use client";

import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cn } from "@/lib/utils";
import type { Tone } from "@/lib/status";

export function Progress({
  value,
  tone = "info",
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> & { value: number; tone?: Tone }) {
  return (
    <ProgressPrimitive.Root
      className={cn("relative h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-3)]", className)}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-tone={tone}
        className="h-full flex-1 bg-[var(--tone-fg)] transition-transform duration-500 ease-[var(--ease-out)]"
        style={{ transform: `translateX(-${100 - Math.min(100, Math.max(0, value))}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}
