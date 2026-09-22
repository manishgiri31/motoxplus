import { MetricCounter, type MetricCounterProps } from "./metric-counter";
import { cn } from "@/lib/utils";

export interface StatStripItem extends Omit<MetricCounterProps, "className" | "valueClassName" | "labelClassName"> {
  key: string;
}

/** Horizontal editorial stat strip — a single divided row on desktop, a
 *  2-column grid on mobile. Wraps MetricCounter; doesn't reimplement it. */
export function StatStrip({
  items,
  /** --line reads correctly on paper but is invisible over a dark/video background
   *  (v2 tokens aren't touched by the data-surface="invert" remap) — set true to
   *  use a literal white divider instead, e.g. on top of MediaHero. */
  invert,
  className,
}: {
  items: StatStripItem[];
  invert?: boolean;
  className?: string;
}) {
  return (
    <dl className={cn("grid grid-cols-2 gap-x-6 gap-y-8 sm:flex sm:items-stretch sm:gap-0", className)}>
      {items.map(({ key, ...metric }, i) => (
        <div
          key={key}
          className={cn(
            "sm:flex-1 sm:px-8",
            i === 0 && "sm:pl-0",
            i > 0 && (invert ? "sm:border-l sm:border-white/15" : "sm:border-l sm:border-[var(--line)]")
          )}
        >
          <MetricCounter
            {...metric}
            valueClassName={invert ? "text-white" : undefined}
            labelClassName={invert ? "text-white/50" : undefined}
          />
        </div>
      ))}
    </dl>
  );
}
