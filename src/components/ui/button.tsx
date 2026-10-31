"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "./slot";
import { Spinner } from "./spinner";
import { cn } from "@/lib/utils";

/**
 * Store design system buttons (spec §10.2): pill, normal case, regular weight,
 * one blue accent. Danger stays a hairline outline that only fills on hover, so
 * "Add Lead" and "Delete Dealer" can never look interchangeable.
 */
export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-pill font-normal " +
    "border transition-[background-color,border-color,color,box-shadow,transform] " +
    "duration-[var(--dur-2)] ease-[var(--ease-std)] active:scale-[.98] " +
    "disabled:pointer-events-none disabled:opacity-40 " +
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] " +
    "[&_svg]:shrink-0 select-none",
  {
    variants: {
      variant: {
        primary:
          "bg-[var(--accent)] border-[var(--accent)] text-[var(--accent-fg)] " +
          "hover:bg-[var(--accent-hover)] hover:border-[var(--accent-hover)] active:bg-[var(--accent-active)]",
        secondary:
          "bg-[var(--surface-1)] border-[var(--border-color)] text-[var(--text-primary)] " +
          "hover:bg-[var(--surface-3)]",
        outline:
          "bg-transparent border-[var(--accent-text)] text-[var(--accent-text)] " +
          "hover:bg-[var(--accent-text)] hover:text-white",
        danger:
          "bg-transparent border-[var(--sig-danger-bd)] text-[var(--sig-danger-fg)] " +
          "hover:bg-[var(--sig-danger-fg)] hover:border-[var(--sig-danger-fg)] hover:text-white",
        link:
          "border-transparent bg-transparent h-auto p-0 " +
          "text-[var(--accent-text)] underline-offset-4 hover:underline",
        solid:
          "bg-[var(--ink)] border-[var(--ink)] text-white hover:bg-[#333336] hover:border-[#333336]",
        brand:
          "bg-[var(--red)] border-[var(--red)] text-white " +
          "hover:bg-[var(--red-hover)] hover:border-[var(--red-hover)]",
        ghost:
          "bg-transparent border-[var(--line)] text-[var(--ink)] hover:bg-black/[.04]",
      },
      size: {
        xs: "h-7 px-3 text-12 [&_svg]:size-3",
        sm: "h-9 px-4 text-14 [&_svg]:size-3.5",
        md: "h-10 px-[22px] text-14 [&_svg]:size-4",
        lg: "h-12 px-[26px] text-17 [&_svg]:size-[18px]",
        icon: "h-9 w-9 p-0 text-14 [&_svg]:size-4",
      },
      block: { true: "w-full" },
    },
    // `link` must win over whatever `size` resolves to (default "md" applies even
    // when size is omitted). cva appends compoundVariants classes last, and Button
    // pipes the whole result through cn()'s twMerge, which keeps the last class.
    compoundVariants: [
      { variant: "link", class: "h-auto p-0 rounded-none [&_svg]:size-[1em]" },
    ],
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
    const cls = cn(buttonVariants({ variant, size, block }), className);

    // asChild clones these props onto a SINGLE child element (e.g. next/link's
    // <Link>) via Radix Slot, which requires exactly one element child — it
    // cannot also interleave icon/spinner nodes around {children} the way the
    // plain <button> path below does. Callers using asChild put icons inside
    // their own child element instead (as every call site in this codebase does).
    if (asChild) {
      return (
        <Slot ref={ref} className={cls} aria-busy={loading || undefined} {...props}>
          {children}
        </Slot>
      );
    }

    return (
      <button ref={ref} className={cls} aria-busy={loading || undefined} disabled={disabled || loading} {...props}>
        {loading ? <Spinner className="size-[1em]" /> : icon}
        {children}
        {!loading && iconRight}
      </button>
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
