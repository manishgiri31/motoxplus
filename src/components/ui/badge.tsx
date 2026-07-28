import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import type { Tone } from "@/lib/status";

/**
 * Generic tone-driven pill for anything that isn't a domain status (counts,
 * labels, "New"). For actual domain statuses (order/payment/dealer/…) use
 * StatusBadge instead — it maps through src/lib/status.ts so the same enum
 * value always renders the same tone/label/icon everywhere in the app.
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-sm border px-2 py-[3px] text-[10px] font-semibold uppercase tracking-tech",
  {
    variants: {
      tone: {
        neutral: "",
        info: "",
        progress: "",
        ok: "",
        warn: "",
        danger: "",
      } satisfies Record<Tone, string>,
    },
    defaultVariants: { tone: "neutral" },
  }
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return (
    <span
      data-tone={tone ?? "neutral"}
      className={cn(
        badgeVariants({ tone }),
        "text-[var(--tone-fg)] bg-[var(--tone-bg)] border-[var(--tone-bd)]",
        className
      )}
      {...props}
    />
  );
}
