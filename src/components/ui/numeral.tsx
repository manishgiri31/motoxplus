import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils";

/**
 * Tabular numerals via Geist Sans's own `tnum` OpenType feature (see the
 * `.tnum` utility in globals.css) — non-tabular figures in a price column or
 * data table is one of the fastest tells of an amateur B2B UI. Deliberately
 * NOT set in the mono font: mono is reserved for part numbers/SKUs/order refs,
 * and tabular-nums on the sans face keeps numeric columns visually lighter
 * while still aligning perfectly.
 */
export function Numeral({
  value,
  unit,
  className,
}: {
  value: React.ReactNode;
  unit?: string;
  className?: string;
}) {
  return (
    <span className={cn("tnum", className)}>
      {value}
      {unit && <span className="ml-0.5 text-[0.85em] text-[var(--text-muted)]">{unit}</span>}
    </span>
  );
}

export function Money({ amount, className }: { amount: number; className?: string }) {
  return <Numeral value={formatCurrency(amount)} className={className} />;
}

export function Qty({ value, unit = "pcs", className }: { value: number; unit?: string; className?: string }) {
  return <Numeral value={value.toLocaleString("en-IN")} unit={unit} className={className} />;
}

/** Part numbers / SKUs / order refs — the one place mono IS correct, since these are codes, not quantities. */
export function PartNo({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("font-mono text-[0.95em] tracking-tight", className)}>{children}</span>;
}
