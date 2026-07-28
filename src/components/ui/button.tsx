"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "./slot";
import { Spinner } from "./spinner";
import { cn } from "@/lib/utils";

/**
 * Brand red vs. destructive red is resolved by FORM, not hue: primary is a
 * solid square fill with white uppercase text; danger is a hairline-bordered
 * outline that only fills on hover. They must never look alike at a glance,
 * even though both ultimately read "red" — that's what keeps "Add Lead" and
 * "Delete Dealer" from being visually interchangeable.
 */
export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold uppercase " +
    "tracking-tech border transition-[background-color,border-color,color,box-shadow] " +
    "duration-[var(--dur-1)] disabled:pointer-events-none disabled:opacity-45 " +
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] " +
    "[&_svg]:shrink-0 select-none",
  {
    variants: {
      variant: {
        primary:
          "bg-[var(--accent)] border-[var(--accent)] text-[var(--accent-fg)] " +
          "hover:bg-[var(--accent-hover)] hover:border-[var(--accent-hover)] active:bg-[var(--accent-active)]",
        secondary:
          "bg-[var(--surface-1)] border-[var(--border-strong)] text-[var(--text-primary)] " +
          "hover:bg-[var(--surface-2)] hover:border-[var(--input-border-hover)]",
        ghost:
          "bg-transparent border-transparent text-[var(--text-secondary)] " +
          "hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]",
        outline:
          "bg-transparent border-[var(--accent)] text-[var(--accent-text)] hover:bg-[var(--accent-soft)]",
        danger:
          "bg-transparent border-[var(--sig-danger-bd)] text-[var(--sig-danger-fg)] " +
          "hover:bg-[var(--sig-danger-fg)] hover:border-[var(--sig-danger-fg)] hover:text-white",
        link:
          "border-transparent bg-transparent h-auto p-0 normal-case tracking-normal " +
          "text-[var(--accent-text)] underline-offset-4 hover:underline",
      },
      size: {
        xs: "h-7 px-2.5 text-[10px] rounded-sm [&_svg]:size-3",
        sm: "h-9 px-3.5 text-[11px] rounded-sm [&_svg]:size-3.5",
        md: "h-10 px-4 text-xs rounded-sm [&_svg]:size-4",
        lg: "h-12 px-6 text-sm rounded-sm [&_svg]:size-[18px]",
        icon: "h-9 w-9 p-0 rounded-sm [&_svg]:size-4",
      },
      block: { true: "w-full" },
    },
    defaultVariants: { variant: "primary", size: "md" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Render the child element (e.g. next/link's <Link>) with button styling/behavior. */
  asChild?: boolean;
  /** Swaps the leading icon for a spinner and sets aria-busy + disabled. */
  loading?: boolean;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, block, asChild, loading, icon, iconRight, children, disabled, ...props },
    ref
  ) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, block }), className)}
        aria-busy={loading || undefined}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? <Spinner className="size-[1em]" /> : icon}
        {children}
        {!loading && iconRight}
      </Comp>
    );
  }
);
Button.displayName = "Button";

export function ButtonGroup({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "inline-flex [&>button]:rounded-none [&>a]:rounded-none " +
          "[&>*:first-child]:rounded-l-sm [&>*:last-child]:rounded-r-sm " +
          "[&>*:not(:first-child)]:-ml-px",
        className
      )}
    >
      {children}
    </div>
  );
}
