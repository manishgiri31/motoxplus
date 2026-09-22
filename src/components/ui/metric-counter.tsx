"use client";

import * as React from "react";
import { useInView, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface MetricCounterProps {
  value: number;
  prefix?: string;
  suffix?: string;
  label?: string;
  /** Decimal places to render, e.g. 1 for "4.8". */
  decimals?: number;
  /** Count-up duration in seconds. */
  duration?: number;
  /** Small red tick beside the value — off by default, use sparingly. */
  accent?: boolean;
  className?: string;
  valueClassName?: string;
  labelClassName?: string;
}

function formatValue(value: number, decimals: number): string {
  return value.toLocaleString("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Counts up from 0 to `value` once, the first time it enters the viewport —
 * mirrors Reveal's `whileInView`/`once`/`-80px` convention so the two read as
 * one system. The rolling digits are purely decorative (`aria-hidden`); a
 * single `sr-only` string carries the real value + label to assistive tech
 * immediately, regardless of animation state.
 */
export function MetricCounter({
  value,
  prefix = "",
  suffix = "",
  label,
  decimals = 0,
  duration = 1.4,
  accent = false,
  className,
  valueClassName,
  labelClassName,
}: MetricCounterProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const reduceMotion = useReducedMotion();
  const [display, setDisplay] = React.useState(0);

  React.useEffect(() => {
    if (!inView) return;
    if (reduceMotion) {
      setDisplay(value);
      return;
    }
    let frame: number;
    const start = performance.now();
    const ms = Math.max(duration, 0.1) * 1000;

    const tick = (now: number) => {
      const t = Math.min((now - start) / ms, 1);
      setDisplay(value * easeOutCubic(t));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, value, duration, reduceMotion]);

  const finalString = `${prefix}${formatValue(value, decimals)}${suffix}`;

  return (
    <div ref={ref} className={cn("flex flex-col", className)}>
      <span className="sr-only">
        {finalString}
        {label ? ` ${label}` : ""}
      </span>

      <div
        aria-hidden="true"
        className={cn(
          "tnum flex items-baseline gap-2 font-display text-4xl font-bold leading-none text-[var(--ink)] md:text-5xl",
          valueClassName
        )}
        // Reserves the final width up front so the count-up never nudges
        // sibling layout as digits are added.
        style={{ minWidth: `${finalString.length}ch` }}
      >
        {accent && <span className="h-px w-4 flex-shrink-0 bg-[var(--red)]" />}
        <span>
          {prefix}
          {formatValue(display, decimals)}
          {suffix}
        </span>
      </div>

      {label && (
        <div
          aria-hidden="true"
          className={cn("mt-2 text-[10px] font-semibold uppercase tracking-eyebrow text-[var(--muted)]", labelClassName)}
        >
          {label}
        </div>
      )}
    </div>
  );
}
