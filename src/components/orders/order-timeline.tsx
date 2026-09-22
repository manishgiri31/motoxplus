import { Check, X, AlertTriangle, Circle } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn, formatDate } from "@/lib/utils";
import type { StatusDomain, Tone } from "@/lib/status";

export type OrderTimelineStepState = "completed" | "current" | "pending" | "cancelled" | "failed";

export interface OrderTimelineStep {
  key: string;
  label: string;
  description?: string;
  date?: string | Date | null;
  state: OrderTimelineStepState;
  /** Optional — attaches the real backend status as a StatusBadge next to the label. */
  statusDomain?: StatusDomain;
  statusValue?: string | null;
}

export interface OrderTimelineProps {
  steps: OrderTimelineStep[];
  orientation?: "horizontal" | "vertical";
  className?: string;
}

const STATE_TONE: Record<OrderTimelineStepState, Tone> = {
  completed: "ok",
  current: "progress",
  pending: "neutral",
  cancelled: "danger",
  failed: "danger",
};

function StepIcon({ state }: { state: OrderTimelineStepState }) {
  const size = 13;
  if (state === "completed") return <Check size={size} aria-hidden />;
  if (state === "cancelled") return <X size={size} aria-hidden />;
  if (state === "failed") return <AlertTriangle size={size} aria-hidden />;
  return <Circle size={size} aria-hidden className={state === "current" ? "fill-current" : undefined} />;
}

/**
 * Generic step sequence — reused for both the conceptual public-facing
 * "how an order flows" diagram and the real dealer order-tracking page. The
 * caller derives each step's `state` from actual Order/Shipment data (or
 * supplies a fixed conceptual list); this component only renders, never
 * infers status itself. Coloring reuses the same `data-tone` mechanism as
 * StatusBadge/Badge; `statusDomain`/`statusValue` optionally attach the
 * literal backend status alongside the human label.
 */
export function OrderTimeline({ steps, orientation = "vertical", className }: OrderTimelineProps) {
  const isHorizontal = orientation === "horizontal";

  return (
    <ol className={cn(isHorizontal ? "flex items-start overflow-x-auto" : "flex flex-col", className)}>
      {steps.map((step, i) => {
        const tone = STATE_TONE[step.state];
        const isLast = i === steps.length - 1;
        return (
          <li
            key={step.key}
            data-tone={tone}
            className={cn(
              "relative flex",
              isHorizontal ? "min-w-[112px] flex-1 flex-col items-center text-center" : "gap-4 pb-8 last:pb-0"
            )}
          >
            {!isLast && (
              <span
                aria-hidden
                className={cn(
                  "absolute bg-[var(--tone-bd)]",
                  isHorizontal ? "left-1/2 top-[13px] h-px w-full" : "bottom-0 left-[13px] top-[26px] w-px"
                )}
              />
            )}
            <span
              className={cn(
                "relative z-[1] flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-full border-2",
                "border-[var(--tone-bd)] bg-[var(--paper)] text-[var(--tone-fg)]",
                step.state === "current" && "animate-pulse-red"
              )}
            >
              <StepIcon state={step.state} />
            </span>

            <div className={isHorizontal ? "mt-2.5" : "pt-0.5"}>
              <div className={cn("flex flex-wrap items-center gap-2", isHorizontal ? "justify-center" : "justify-start")}>
                <span
                  className={cn(
                    "text-xs font-bold uppercase tracking-tech",
                    step.state === "pending" ? "text-[var(--muted)]" : "text-[var(--ink)]"
                  )}
                >
                  {step.label}
                </span>
                {step.statusDomain && <StatusBadge domain={step.statusDomain} value={step.statusValue} />}
              </div>
              {step.description && (
                <p className={cn("mt-1 text-xs text-[var(--muted)]", isHorizontal && "max-w-[18ch]")}>{step.description}</p>
              )}
              {step.date && <time className="tnum mt-1 block text-[10px] text-[var(--text-faint)]">{formatDate(step.date)}</time>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
