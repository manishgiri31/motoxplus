import {
  Clock,
  Check,
  CheckCheck,
  X,
  AlertTriangle,
  Truck,
  Package,
  Send,
  Pause,
  Ban,
  Circle,
  Flame,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { statusMeta, type StatusDomain, type StatusIcon } from "@/lib/status";

/**
 * Replaces the 18 locally-redefined STATUS_COLORS/statusStyle maps (two
 * mutually incompatible color conventions, four pill shapes) with one
 * component driven entirely by src/lib/status.ts. Never emits a color
 * utility directly — only `data-tone`, which the six rules in globals.css
 * resolve to actual colors. Always pairs color with an icon + label, so
 * red/green colour-blindness is never the only signal.
 */
const ICONS: Record<StatusIcon, LucideIcon> = {
  clock: Clock,
  check: Check,
  checkCheck: CheckCheck,
  x: X,
  alert: AlertTriangle,
  truck: Truck,
  package: Package,
  send: Send,
  pause: Pause,
  ban: Ban,
  circle: Circle,
  dot: Circle,
  flame: Flame,
  refresh: RefreshCw,
};

export interface StatusBadgeProps {
  domain: StatusDomain;
  value?: string | null;
  /** Hide the icon — rare; only for very dense table cells where the icon crowds the label. */
  iconless?: boolean;
  className?: string;
}

export function StatusBadge({ domain, value, iconless, className }: StatusBadgeProps) {
  const meta = statusMeta(domain, value);
  const Icon = ICONS[meta.icon];
  const isDot = meta.icon === "dot";

  return (
    <span
      data-tone={meta.tone}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border px-2 py-[3px]",
        "text-[10px] font-semibold uppercase tracking-tech whitespace-nowrap",
        "text-[var(--tone-fg)] bg-[var(--tone-bg)] border-[var(--tone-bd)]",
        className
      )}
    >
      {!iconless &&
        (isDot ? (
          <span
            className={cn(
              "size-1.5 rounded-full bg-[var(--tone-fg)]",
              meta.pulse && "animate-pulse-red"
            )}
            aria-hidden
          />
        ) : (
          <Icon size={11} aria-hidden className={cn(meta.pulse && "animate-pulse-red")} />
        ))}
      {meta.label}
    </span>
  );
}

/** A bare tone-colored dot with no label/border — dense table cells, pipeline columns. */
export function StatusDot({ domain, value, className }: { domain: StatusDomain; value?: string | null; className?: string }) {
  const meta = statusMeta(domain, value);
  return (
    <span
      data-tone={meta.tone}
      className={cn("inline-block size-2 rounded-full bg-[var(--tone-fg)]", meta.pulse && "animate-pulse-red", className)}
      title={meta.label}
      aria-label={meta.label}
    />
  );
}
