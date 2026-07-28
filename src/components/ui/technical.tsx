import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The industrial visual vocabulary — blueprint grids, CAD dimension lines,
 * spec-table treatment, corner frames. All decorative elements are
 * `aria-hidden` + `pointer-events-none` where they carry no information of
 * their own. Grids/hatches are CSS `repeating-linear-gradient` (see
 * .bp-grid/.bp-grid-major/.hatch-45 in globals.css) — zero DOM, one paint
 * layer, no repaint cost on scroll. Never combine them with
 * `background-attachment: fixed`, which forces a full repaint on scroll.
 */

/** Bosch/Porsche section-label device: a small rule + uppercase tracked label. */
export function Eyebrow({
  children,
  index,
  rule = true,
  className,
}: {
  children: React.ReactNode;
  index?: string;
  rule?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2.5 text-eyebrow text-[var(--text-muted)]", className)}>
      {rule && <span className="h-px w-6 bg-[var(--accent)]" aria-hidden />}
      {index && <span className="tnum text-[var(--accent-text)]">{index}</span>}
      <span>{children}</span>
    </div>
  );
}

/** A drawn hairline — not a shadow edge. Uses background so margin-collapse can't eat it. */
export function Rule({
  orientation = "h",
  weight = "hair",
  inset = false,
  className,
}: {
  orientation?: "h" | "v";
  weight?: "hair" | "strong";
  inset?: boolean;
  className?: string;
}) {
  const color = weight === "strong" ? "bg-[var(--rule-strong)]" : "bg-[var(--rule)]";
  return (
    <div
      aria-hidden
      className={cn(
        orientation === "h" ? "w-full h-px" : "h-full w-px",
        inset && (orientation === "h" ? "mx-4" : "my-4"),
        color,
        className
      )}
    />
  );
}

/** Machinist's-ruler tick pattern — section dividers. */
export function TickRule({ every = 8, className }: { every?: number; className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("h-2 w-full", className)}
      style={{
        backgroundImage: `repeating-linear-gradient(90deg, var(--rule-strong) 0 1px, transparent 1px ${every}px)`,
      }}
    />
  );
}

/** The CAD/viewfinder corner-bracket device — carries the industrial aesthetic
 *  in light mode where shadows can't. Four absolutely-positioned spans rather
 *  than pseudo-elements, since only two pseudo-elements are available and the
 *  bracket length needs to be a prop. */
export function CornerFrame({
  size = 12,
  weight = 1,
  corners = "all",
  className,
  children,
}: {
  size?: number;
  weight?: number;
  corners?: "all" | "tl-br";
  className?: string;
  children?: React.ReactNode;
}) {
  const base = "absolute border-[var(--rule-strong)]";
  const s = `${size}px`;
  const w = `${weight}px`;
  return (
    <div className={cn("relative", className)}>
      <span
        aria-hidden
        className={cn(base, "top-0 left-0")}
        style={{ width: s, height: s, borderTopWidth: w, borderLeftWidth: w }}
      />
      <span
        aria-hidden
        className={cn(base, "bottom-0 right-0")}
        style={{ width: s, height: s, borderBottomWidth: w, borderRightWidth: w }}
      />
      {corners === "all" && (
        <>
          <span
            aria-hidden
            className={cn(base, "top-0 right-0")}
            style={{ width: s, height: s, borderTopWidth: w, borderRightWidth: w }}
          />
          <span
            aria-hidden
            className={cn(base, "bottom-0 left-0")}
            style={{ width: s, height: s, borderBottomWidth: w, borderLeftWidth: w }}
          />
        </>
      )}
      {children}
    </div>
  );
}

/** A CAD dimension line with arrowheads — inline SVG, ~380B, honest tool for the job. */
export function DimensionLine({
  value,
  orientation = "h",
  extend = 12,
  className,
}: {
  value: string;
  orientation?: "h" | "v";
  extend?: number;
  className?: string;
}) {
  const isH = orientation === "h";
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 text-[10px] tnum text-[var(--text-muted)]",
        !isH && "flex-col",
        className
      )}
    >
      <svg
        aria-hidden
        width={isH ? 40 : extend}
        height={isH ? extend : 40}
        viewBox={isH ? `0 0 40 ${extend}` : `0 0 ${extend} 40`}
        className="text-[var(--rule-strong)]"
      >
        {isH ? (
          <>
            <line x1="0" y1={extend / 2} x2="40" y2={extend / 2} stroke="currentColor" strokeWidth="1" />
            <path d={`M0 ${extend / 2 - 3} L4 ${extend / 2} L0 ${extend / 2 + 3}`} fill="none" stroke="currentColor" strokeWidth="1" />
            <path d={`M40 ${extend / 2 - 3} L36 ${extend / 2} L40 ${extend / 2 + 3}`} fill="none" stroke="currentColor" strokeWidth="1" />
          </>
        ) : (
          <>
            <line x1={extend / 2} y1="0" x2={extend / 2} y2="40" stroke="currentColor" strokeWidth="1" />
            <path d={`M${extend / 2 - 3} 0 L${extend / 2} 4 L${extend / 2 + 3} 0`} fill="none" stroke="currentColor" strokeWidth="1" />
            <path d={`M${extend / 2 - 3} 40 L${extend / 2} 36 L${extend / 2 + 3} 40`} fill="none" stroke="currentColor" strokeWidth="1" />
          </>
        )}
      </svg>
      <span>{value}</span>
    </div>
  );
}

export interface SpecRow {
  label: string;
  value: React.ReactNode;
  unit?: string;
  note?: string;
}

/** Engineering parts-list treatment — the honest replacement for "feature cards"
 *  on product/spec pages. Dot-leader between label and value, tabular values. */
export function SpecTable({ rows, dense, className }: { rows: SpecRow[]; dense?: boolean; className?: string }) {
  return (
    <dl className={cn("divide-y divide-[var(--border-subtle)]", className)}>
      {rows.map((row, i) => (
        <div key={i} className={cn("flex flex-wrap items-baseline gap-x-3", dense ? "py-1.5" : "py-2.5")}>
          <dt className="flex-shrink-0 text-xs text-[var(--text-muted)]">{row.label}</dt>
          <span aria-hidden className="flex-1 border-b border-dotted border-[var(--rule)] translate-y-[-3px]" />
          <dd className="tnum flex-shrink-0 text-right text-xs font-semibold text-[var(--text-primary)]">
            {row.value}
            {row.unit && <span className="ml-0.5 font-normal text-[var(--text-muted)]">{row.unit}</span>}
          </dd>
          {row.note && <span className="basis-full text-[10px] text-[var(--text-faint)]">{row.note}</span>}
        </div>
      ))}
    </dl>
  );
}

/** Exploded-diagram annotation marker — a numbered dot for use inside AnnotatedMedia. */
export function Callout({
  n,
  label,
  className,
}: {
  n: number;
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        // Always a dark chip regardless of theme — a marker on top of photography
        // needs to read consistently, not flip color with the page's theme.
        // --carbon-950 is theme-independent (declared once in :root, never
        // redeclared in .dark), unlike --text-primary which does flip.
        "inline-flex items-center gap-1.5 rounded-full bg-[rgb(var(--carbon-950))] px-1.5 py-0.5",
        "text-[10px] font-bold text-white shadow-[var(--elev-2)]",
        className
      )}
    >
      <span className="tnum">{n}</span>
      {label && <span className="font-medium">{label}</span>}
    </span>
  );
}

/** Left keyline bar — the Brembo/Bosch emphasis device in a light UI (see also Card's `edge` prop). */
export function KeyEdge({
  tone = "accent",
  width = 3,
  className,
}: {
  tone?: "accent" | "ok" | "warn" | "danger" | "neutral";
  width?: number;
  className?: string;
}) {
  const toneVar =
    tone === "accent"
      ? "var(--accent)"
      : tone === "ok"
      ? "var(--sig-ok-fg)"
      : tone === "warn"
      ? "var(--sig-warn-fg)"
      : tone === "danger"
      ? "var(--sig-danger-fg)"
      : "var(--sig-neutral-fg)";
  return (
    <span
      aria-hidden
      className={cn("absolute inset-y-0 left-0 rounded-l-lg", className)}
      style={{ width, background: toneVar }}
    />
  );
}

/** Zero-DOM blueprint grid background — see .bp-grid/.bp-grid-major in globals.css. */
export function BlueprintGrid({
  major = false,
  fade = "none",
  className,
}: {
  major?: boolean;
  fade?: "bottom" | "radial" | "none";
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0",
        major ? "bp-grid-major" : "bp-grid",
        fade === "bottom" && "[mask-image:linear-gradient(to_bottom,black,transparent)]",
        fade === "radial" && "[mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]",
        className
      )}
    />
  );
}

/** "Unavailable / out of stock / pending" texture — pattern, not colour, so it reads
 *  correctly for colour-blind users. See .hatch-45 in globals.css. */
export function Hatch({ className }: { className?: string }) {
  return <div aria-hidden className={cn("pointer-events-none absolute inset-0 hatch-45", className)} />;
}
