import * as React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Eyebrow } from "./technical";

/**
 * Replaces the identical `mb-8 flex items-center justify-between` block
 * duplicated once each across 50 files (every admin/dealer/vendor list and
 * detail page). `eyebrow` is the Bosch/Porsche section-label device used
 * throughout the redesign, e.g. "PROCUREMENT / 04".
 */
export interface Breadcrumb {
  label: string;
  href?: string;
}

export interface PageHeaderProps {
  title: string;
  eyebrow?: string;
  description?: React.ReactNode;
  breadcrumbs?: Breadcrumb[];
  actions?: React.ReactNode;
  /** Inline stat strip, e.g. "128 total · 12 pending" */
  meta?: React.ReactNode;
  rule?: boolean;
  className?: string;
}

export function PageHeader({
  title,
  eyebrow,
  description,
  breadcrumbs,
  actions,
  meta,
  rule = true,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("mb-8", rule && "pb-6 border-b border-[var(--border-subtle)]", className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="mb-3 flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
          {breadcrumbs.map((b, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && <ChevronRight size={12} className="opacity-50" aria-hidden />}
              {b.href ? (
                <Link href={b.href} className="hover:text-[var(--text-primary)] transition-colors">
                  {b.label}
                </Link>
              ) : (
                <span className="text-[var(--text-secondary)]">{b.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && <Eyebrow className="mb-2">{eyebrow}</Eyebrow>}
          <h1 className="text-2xl md:text-3xl font-black text-[var(--text-primary)] tracking-tight">
            {title}
          </h1>
          {description && <p className="mt-1 text-sm text-[var(--text-muted)]">{description}</p>}
          {meta && <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1">{meta}</div>}
        </div>
        {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
      </div>
    </div>
  );
}
