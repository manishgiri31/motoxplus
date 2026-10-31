import * as React from "react";
import Link from "next/link";
import { ChevronRight, TrendingUp, TrendingDown, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "./card";
import { Numeral } from "./numeral";
import { SkeletonText } from "./skeleton";
import type { Tone } from "@/lib/status";

/**
 * Unifies the 3 divergent KPI-tile variants found across admin/dealer/vendor
 * dashboards (rounded-2xl Link with border-l-4 + chevron / rounded-sm plain
 * div with a sub line / rounded-xl p-4 text-center with no icon at all) into
 * one design: flat surface, hairline border, 3px left KeyEdge, no lift-on-hover
 * (the pillowy translateY(-6px) from .card-hover reads consumer, not instrument).
 */
export interface StatCardProps {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  unit?: string;
  icon?: LucideIcon;
  href?: string;
  tone?: Tone;
  trend?: { value: number; direction: "up" | "down"; goodWhen?: "up" | "down" };
  loading?: boolean;
  className?: string;
}

export function StatCard({ label, value, sub, unit, icon: Icon, href, tone = "neutral", trend, loading, className }: StatCardProps) {
  const content = (
    <>
      <div className="flex items-center justify-between mb-4">
        {Icon && (
          <div data-tone={tone} className="w-9 h-9 rounded-full flex items-center justify-center bg-[var(--tone-bg)]">
            <Icon size={17} className="text-[var(--tone-fg)]" />
          </div>
        )}
        {href && <ChevronRight size={14} className="text-[var(--text-muted)] group-hover:text-[var(--accent)] transition-colors" />}
      </div>

      {loading ? (
        <SkeletonText className="h-7 w-20 mb-2" />
      ) : (
        <div className="text-[32px] font-semibold leading-[1.1] tracking-[-0.015em] text-[var(--text-primary)] mb-1">
          <Numeral value={value} unit={unit} />
        </div>
      )}

      <div className="flex items-center gap-2">
        <div className="text-[var(--text-muted)] text-14">{label}</div>
        {trend && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-12 font-bold tnum",
              (trend.goodWhen ?? "up") === trend.direction ? "text-[var(--sig-ok-fg)]" : "text-[var(--sig-danger-fg)]"
            )}
          >
            {trend.direction === "up" ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {Math.abs(trend.value)}%
          </span>
        )}
      </div>
      {sub && <div className="mt-1 text-12 text-[var(--text-muted)]">{sub}</div>}
    </>
  );

  const className_ = cn(
    "group relative bg-[var(--bg-card)] rounded-[18px] p-6",
    "transition-colors duration-[var(--dur-2)]",
    href && "hover:shadow-s2",
    className
  );

  if (href) {
    return (
      <Link href={href} className={className_}>
        {content}
      </Link>
    );
  }
  return <Card className={className_}>{content}</Card>;
}

/** Canonicalises the `grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8` wrapper repeated across all 3 dashboards. */
export function StatGrid({ cols = 4, className, children }: { cols?: 2 | 3 | 4; className?: string; children: React.ReactNode }) {
  const colsClass = cols === 2 ? "lg:grid-cols-2" : cols === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4";
  return <div className={cn("grid grid-cols-2 gap-4", colsClass, className)}>{children}</div>;
}
