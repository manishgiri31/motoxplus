"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { SkeletonTable } from "./skeleton";
import { Checkbox } from "./field";

/**
 * Replaces the identical table wrapper/thead/tbody markup duplicated across
 * 14 files (87 header cells total) — including a dead, invalid Tailwind class
 * (`hover:bg-white/2`, not a real opacity step) present in all 14. Adds
 * `scope="col"`, a visually-hidden `<caption>`, `aria-sort`, tabular numerals,
 * a real skeleton state, and a horizontal scroll container none of the
 * originals had consistently.
 */
const HIDE_BELOW_CLASS = {
  sm: "hidden sm:table-cell",
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
  xl: "hidden xl:table-cell",
} as const;

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  cell?: (row: T, index: number) => React.ReactNode;
  align?: "left" | "right" | "center";
  width?: string;
  hideBelow?: keyof typeof HIDE_BELOW_CLASS;
  numeric?: boolean;
  className?: string;
}

export interface SortState {
  key: string;
  dir: "asc" | "desc";
}

export interface DataTableProps<T extends { id: string }> {
  columns: Column<T>[];
  rows: T[];
  loading?: boolean;
  skeletonRows?: number;
  empty?: React.ReactNode;
  /** Renders the whole row as a real, keyboard/right-click-accessible link via a
   *  stretched-anchor overlay — not a fake onClick handler pretending to be one. */
  rowHref?: (row: T) => string;
  onRowClick?: (row: T) => void;
  actions?: (row: T) => React.ReactNode;
  selectable?: boolean;
  selected?: Set<string>;
  onSelectionChange?: (selected: Set<string>) => void;
  sort?: SortState;
  onSortChange?: (sort: SortState) => void;
  density?: "compact" | "normal";
  caption?: string;
  stickyHeader?: boolean;
  footer?: React.ReactNode;
  className?: string;
}

const alignClass = { left: "text-left", right: "text-right", center: "text-center" } as const;

export function DataTable<T extends { id: string }>({
  columns,
  rows,
  loading,
  skeletonRows = 5,
  empty,
  rowHref,
  onRowClick,
  actions,
  selectable,
  selected,
  onSelectionChange,
  sort,
  onSortChange,
  density = "normal",
  caption,
  stickyHeader,
  footer,
  className,
}: DataTableProps<T>) {
  if (loading) return <SkeletonTable rows={skeletonRows} cols={columns.length} className={className} />;

  if (rows.length === 0) {
    return (
      <div className={cn("bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg", className)}>
        {empty ?? <div className="py-16 text-center text-sm text-[var(--text-muted)]">No records found.</div>}
      </div>
    );
  }

  const allSelected = selectable && selected && rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggleAll = () => {
    if (!onSelectionChange || !selected) return;
    onSelectionChange(allSelected ? new Set() : new Set(rows.map((r) => r.id)));
  };
  const toggleOne = (id: string) => {
    if (!onSelectionChange || !selected) return;
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange(next);
  };

  const padY = density === "compact" ? "py-2" : "py-3.5";

  return (
    <div className={cn("bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg overflow-hidden", className)}>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead className={cn(stickyHeader && "sticky top-0 z-10", "bg-[var(--surface-3)]")}>
            <tr>
              {selectable && (
                <th scope="col" className="w-10 px-4 py-3">
                  <Checkbox checked={!!allSelected} onChange={toggleAll} aria-label="Select all rows" />
                </th>
              )}
              {columns.map((col) => {
                const isSorted = sort?.key === col.key;
                const SortIcon = isSorted ? (sort!.dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
                return (
                  <th
                    key={col.key}
                    scope="col"
                    aria-sort={isSorted ? (sort!.dir === "asc" ? "ascending" : "descending") : onSortChange ? "none" : undefined}
                    className={cn(
                      "px-4 py-3 text-[10px] font-bold uppercase tracking-tech text-[var(--text-muted)]",
                      alignClass[col.align ?? (col.numeric ? "right" : "left")],
                      col.hideBelow && HIDE_BELOW_CLASS[col.hideBelow],
                      col.className
                    )}
                    style={col.width ? { width: col.width } : undefined}
                  >
                    {onSortChange ? (
                      <button
                        type="button"
                        onClick={() => onSortChange({ key: col.key, dir: isSorted && sort!.dir === "asc" ? "desc" : "asc" })}
                        className="inline-flex items-center gap-1 hover:text-[var(--text-primary)] transition-colors"
                      >
                        {col.header}
                        <SortIcon size={11} />
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                );
              })}
              {actions && <th scope="col" className="w-px px-4 py-3" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {rows.map((row, i) => {
              const href = rowHref?.(row);
              return (
                <tr
                  key={row.id}
                  className={cn(
                    "relative transition-colors",
                    (href || onRowClick) && "hover:bg-[var(--bg-card-hover)] cursor-pointer",
                    selected?.has(row.id) && "bg-[var(--accent-soft)]"
                  )}
                  onClick={!href ? () => onRowClick?.(row) : undefined}
                >
                  {selectable && (
                    <td className="relative z-10 px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={!!selected?.has(row.id)} onChange={() => toggleOne(row.id)} aria-label={`Select row ${i + 1}`} />
                    </td>
                  )}
                  {columns.map((col, ci) => (
                    <td
                      key={col.key}
                      className={cn(
                        "px-4 relative",
                        padY,
                        alignClass[col.align ?? (col.numeric ? "right" : "left")],
                        col.numeric && "tnum",
                        col.hideBelow && HIDE_BELOW_CLASS[col.hideBelow],
                        col.className
                      )}
                    >
                      {href && ci === 0 && (
                        <Link href={href} className="absolute inset-0 z-0" aria-label={`Open row ${i + 1}`} />
                      )}
                      <span className="relative z-[1]">{col.cell ? col.cell(row, i) : String((row as Record<string, unknown>)[col.key] ?? "—")}</span>
                    </td>
                  ))}
                  {actions && (
                    <td className="relative z-10 px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      {actions(row)}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {footer && <div className="border-t border-[var(--border-subtle)] px-4 py-3">{footer}</div>}
    </div>
  );
}

/** Building blocks for hand-composed tables that don't fit the row-based DataTable shape. */
export function TableRoot({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg overflow-hidden", className)}>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">{children}</table>
      </div>
    </div>
  );
}
export function THead({ className, children }: { className?: string; children: React.ReactNode }) {
  return <thead className={cn("bg-[var(--surface-3)]", className)}>{children}</thead>;
}
export function TR({ className, children, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className={cn("divide-y divide-[var(--border-subtle)]", className)} {...props}>
      {children}
    </tr>
  );
}
export function TH({ className, children, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th scope="col" className={cn("px-4 py-3 text-left text-[10px] font-bold uppercase tracking-tech text-[var(--text-muted)]", className)} {...props}>
      {children}
    </th>
  );
}
export function TD({ className, children, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn("px-4 py-3.5 border-t border-[var(--border-subtle)]", className)} {...props}>
      {children}
    </td>
  );
}
