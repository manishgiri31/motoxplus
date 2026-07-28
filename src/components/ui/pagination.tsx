import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Numeral } from "./numeral";

/**
 * Replaces `Array.from({length: totalPages})` (10 files) — renders every
 * page number, which breaks past ~30 pages. Caps at 9 visible nodes with
 * ellipsis collapse: ‹ 1 … 7 8 [9] 10 11 … 42 ›
 */
export function paginationRange(current: number, total: number, siblings = 1): (number | "…")[] {
  const totalNumbers = siblings * 2 + 5; // first, last, current, 2*siblings, 2 ellipses-as-numbers
  if (total <= totalNumbers) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const leftIndex = Math.max(current - siblings, 1);
  const rightIndex = Math.min(current + siblings, total);
  const showLeftEllipsis = leftIndex > 2;
  const showRightEllipsis = rightIndex < total - 1;

  const range: (number | "…")[] = [1];
  if (showLeftEllipsis) range.push("…");
  for (let i = leftIndex; i <= rightIndex; i++) {
    if (i !== 1 && i !== total) range.push(i);
  }
  if (showRightEllipsis) range.push("…");
  if (total !== 1) range.push(total);
  return range;
}

export interface PaginationProps {
  page: number;
  totalPages: number;
  totalItems?: number;
  pageSize?: number;
  /** Server-component pages (all 10 today) — renders real <Link> hrefs. */
  hrefFor?: (page: number) => string;
  /** Client pages — imperative page change. */
  onPageChange?: (page: number) => void;
  siblings?: number;
  className?: string;
}

export function Pagination({ page, totalPages, totalItems, pageSize, hrefFor, onPageChange, siblings = 1, className }: PaginationProps) {
  if (totalPages <= 1) return null;
  const nodes = paginationRange(page, totalPages, siblings);

  const go = (target: number) => {
    if (target < 1 || target > totalPages || target === page) return undefined;
    return hrefFor ? hrefFor(target) : undefined;
  };

  const Item = ({ target, children, active, disabled, label }: { target: number; children: React.ReactNode; active?: boolean; disabled?: boolean; label: string }) => {
    const commonClass = cn(
      "inline-flex h-8 min-w-8 items-center justify-center rounded-sm px-2 text-xs font-semibold tnum transition-colors",
      active
        ? "bg-[var(--accent)] text-[var(--accent-fg)]"
        : disabled
        ? "text-[var(--text-faint)] pointer-events-none"
        : "text-[var(--text-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]"
    );
    if (hrefFor && !disabled) {
      return (
        <Link href={go(target) ?? "#"} aria-label={label} aria-current={active ? "page" : undefined} className={commonClass}>
          {children}
        </Link>
      );
    }
    return (
      <button
        type="button"
        aria-label={label}
        aria-current={active ? "page" : undefined}
        disabled={disabled}
        onClick={() => onPageChange?.(target)}
        className={commonClass}
      >
        {children}
      </button>
    );
  };

  return (
    <nav aria-label="Pagination" className={cn("flex items-center justify-between gap-4 flex-wrap", className)}>
      {totalItems != null && pageSize != null && (
        <p className="text-xs text-[var(--text-muted)]">
          Showing <Numeral value={(page - 1) * pageSize + 1} />–<Numeral value={Math.min(page * pageSize, totalItems)} /> of{" "}
          <Numeral value={totalItems} />
        </p>
      )}
      <div className="flex items-center gap-1">
        <Item target={page - 1} label="Previous page" disabled={page <= 1}>
          <ChevronLeft size={14} />
        </Item>
        {nodes.map((n, i) =>
          n === "…" ? (
            <span key={`e${i}`} className="inline-flex h-8 min-w-8 items-center justify-center text-xs text-[var(--text-faint)]">
              …
            </span>
          ) : (
            <Item key={n} target={n} label={`Page ${n}`} active={n === page}>
              {n}
            </Item>
          )
        )}
        <Item target={page + 1} label="Next page" disabled={page >= totalPages}>
          <ChevronRight size={14} />
        </Item>
      </div>
    </nav>
  );
}
