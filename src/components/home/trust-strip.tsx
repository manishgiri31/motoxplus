const items = [
  "500+ Products",
  "18+ States Covered",
  "10,000+ Units / Month",
  "ISO Certified Manufacturing",
  "OEM Compatible Parts",
  "500+ Active Dealers",
  "48h Average Delivery",
  "98% Order Fulfilment Rate",
  "15+ Years Experience",
  "GST Compliant Invoicing",
];

export function TrustStrip() {
  const doubled = [...items, ...items];

  return (
    <div className="relative overflow-hidden border-y border-[var(--border-color)] bg-[var(--bg-secondary)] py-3 select-none">
      {/* Fade edges */}
      <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-[var(--bg-secondary)] to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-[var(--bg-secondary)] to-transparent z-10 pointer-events-none" />

      <div className="flex gap-0 marquee-track">
        {doubled.map((item, i) => (
          <div
            key={i}
            className="flex items-center gap-6 flex-shrink-0 px-8"
          >
            <span className="w-1 h-1 rounded-full bg-red-600 flex-shrink-0" />
            <span className="text-[var(--text-muted)] text-xs font-semibold uppercase tracking-widest whitespace-nowrap">
              {item}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
