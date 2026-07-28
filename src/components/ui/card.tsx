import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import type { Tone } from "@/lib/status";

/**
 * Deliberately does NOT use the `.glass` class (see globals.css): a
 * backdrop-filter blur over an opaque light canvas is visually a no-op but
 * still costs a compositor layer on every one of the ~400 existing `.glass`
 * call sites. Card is an opaque surface; `.glass` stays reserved for the
 * navbar and true overlays where there's something behind them to blur.
 */
const cardVariants = cva("relative bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg", {
  variants: {
    elevation: {
      flat: "shadow-none",
      raised: "shadow-[var(--elev-2)]",
      overlay: "shadow-[var(--elev-3)]",
    },
    /** Brembo/Bosch keyline — how emphasis reads in a light industrial UI without a glow.
     *  "accent" is brand emphasis (unconditional red); "tone" reads the `tone` prop
     *  through the same data-tone mechanism as StatusBadge/Badge/StatCard, covering
     *  all six semantic tones instead of hardcoding a handful of status colors here. */
    edge: {
      none: "",
      accent: "before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:rounded-l-lg before:bg-[var(--accent)]",
      tone: "before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:rounded-l-lg before:bg-[var(--tone-fg)]",
    },
    inset: {
      none: "",
      grid: "bp-grid",
      hatch: "hatch-45",
    },
    interactive: {
      true: "transition-colors duration-[var(--dur-2)] hover:bg-[var(--bg-card-hover)] hover:border-[var(--border-strong)]",
    },
    pad: {
      none: "p-0",
      sm: "p-4",
      md: "p-5",
      lg: "p-6",
    },
  },
  defaultVariants: { elevation: "flat", edge: "none", inset: "none", pad: "md" },
});

export interface CardProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof cardVariants> {
  /** Only read when edge="tone" — sets data-tone so the keyline (and any
   *  --tone-fg/--tone-bg/--tone-bd usage inside) resolves to the right color. */
  tone?: Tone;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, elevation, edge, inset, interactive, pad, tone, ...props }, ref) => (
    <div
      ref={ref}
      data-tone={edge === "tone" ? tone ?? "neutral" : undefined}
      className={cn(cardVariants({ elevation, edge, inset, interactive, pad }), className)}
      {...props}
    />
  )
);
Card.displayName = "Card";

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-4 flex items-center justify-between gap-4", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-sm font-bold text-[var(--text-primary)]", className)} {...props} />;
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("mt-0.5 text-xs text-[var(--text-muted)]", className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn(className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("mt-4 flex items-center gap-3 border-t border-[var(--border-subtle)] pt-4", className)}
      {...props}
    />
  );
}

export function CardToolbar({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-center gap-2", className)} {...props} />;
}
