import { cn } from "@/lib/utils";

/** Thin wrappers over the existing `.skeleton` shimmer class (globals.css) —
 *  gives loading states a consistent shape vocabulary instead of ad-hoc divs. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} />;
}

export function SkeletonText({ className }: { className?: string }) {
  return <div className={cn("skeleton h-4 w-full", className)} />;
}

export function SkeletonCard({ className }: { className?: string }) {
  return <div className={cn("skeleton h-32 w-full rounded-lg", className)} />;
}

export function SkeletonTable({ rows = 5, cols = 4, className }: { rows?: number; cols?: number; className?: string }) {
  return (
    <div className={cn("bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg overflow-hidden", className)}>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 px-4 py-3 border-b border-[var(--border-subtle)] last:border-0">
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} className="skeleton h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}
