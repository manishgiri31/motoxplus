import Link from "next/link";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const chipClass = (active: boolean | undefined, className?: string) =>
  cn(
    "inline-flex items-center gap-1.5 rounded-pill border px-3.5 py-1.5 text-14 transition-colors duration-[var(--dur-2)]",
    active
      ? "bg-[var(--ink)] border-[var(--ink)] text-white"
      : "bg-[var(--surface-1)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-black/[.04] hover:text-[var(--text-primary)]",
    className
  );

function ChipCount({ count, active }: { count?: number; active?: boolean }) {
  if (count == null) return null;
  return <span className={cn("tnum text-12", active ? "text-white/70" : "text-[var(--text-muted)]")}>{count}</span>;
}

function ChipRemove({ onRemove }: { onRemove: () => void }) {
  return (
    <span
      role="button"
      tabIndex={-1}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onRemove();
      }}
      className="ml-0.5 -mr-1 rounded-full p-0.5 hover:bg-black/10"
      aria-label="Remove filter"
    >
      <X size={11} />
    </span>
  );
}

interface FilterChipBaseProps {
  active?: boolean;
  onRemove?: () => void;
  children: React.ReactNode;
  count?: number;
  className?: string;
}

/**
 * Replaces the repeated filter-chip row pattern across 5 admin pages.
 * Renders as a real `<Link>` when `href` is given (server-component pages that
 * filter via URL searchParams — the common case in this codebase) or a
 * `<button>` when `onClick` is given (client-side filtering). Never nest an
 * anchor inside this component's button form — that's invalid HTML and was
 * the bug this split fixes.
 */
export function FilterChip(props: FilterChipBaseProps & { href: string; onClick?: never }): React.JSX.Element;
export function FilterChip(props: FilterChipBaseProps & { onClick?: () => void; href?: never }): React.JSX.Element;
export function FilterChip({
  active,
  onClick,
  href,
  onRemove,
  children,
  count,
  className,
}: FilterChipBaseProps & { onClick?: () => void; href?: string }) {
  if (href) {
    return (
      <Link href={href} aria-current={active ? "page" : undefined} className={chipClass(active, className)}>
        {children}
        <ChipCount count={count} active={active} />
        {onRemove && <ChipRemove onRemove={onRemove} />}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={chipClass(active, className)}>
      {children}
      <ChipCount count={count} active={active} />
      {onRemove && <ChipRemove onRemove={onRemove} />}
    </button>
  );
}

export function FilterChips({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex flex-wrap items-center gap-2", className)}>{children}</div>;
}
