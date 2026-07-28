import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Replaces ~12 copies of the same "no orders yet" block that disagreed on
 * padding (py-20 vs p-16), radius (rounded-xl vs rounded-sm) and icon size
 * (48 vs 40) from one file to the next.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center py-16 px-6",
        "bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg",
        className
      )}
    >
      {Icon && (
        <div className="w-12 h-12 rounded-sm bg-[var(--surface-2)] flex items-center justify-center mb-4">
          <Icon size={22} className="text-[var(--text-muted)]" />
        </div>
      )}
      <h3 className="text-[var(--text-primary)] font-bold text-base mb-1">{title}</h3>
      {description && <p className="text-[var(--text-muted)] text-sm max-w-sm mb-4">{description}</p>}
      {action}
    </div>
  );
}
