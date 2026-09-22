import { SectionIntro } from "@/components/ui/section-intro";
import { StatStrip } from "@/components/ui/stat-strip";

export interface ProductionMetricsProps {
  skuCount: number;
  dealerCount: number;
  stateCount: number;
}

/** Section 03 — the five headline production/network numbers, animated on scroll. */
export function ProductionMetrics({ skuCount, dealerCount, stateCount }: ProductionMetricsProps) {
  return (
    <section className="border-t border-[var(--line)] bg-[var(--card)] px-4 py-20 md:px-8 md:py-24">
      <div className="mx-auto max-w-7xl">
        <SectionIntro index="03" eyebrow="Scale" headline="A manufacturing operation, not a workshop." align="center" className="mb-14" />
        <StatStrip
          className="mx-auto max-w-5xl"
          items={[
            { key: "sku", value: skuCount, suffix: "+", label: "SKUs" },
            { key: "units", value: 10, suffix: "K+", label: "Units / Month" },
            { key: "qc", value: 98, suffix: "%", label: "QC Pass Rate", accent: true },
            { key: "dealers", value: dealerCount, suffix: "+", label: "Dealer Partners" },
            { key: "states", value: stateCount, suffix: "+", label: "States" },
          ]}
        />
      </div>
    </section>
  );
}
