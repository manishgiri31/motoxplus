import { ArrowRight } from "lucide-react";
import { SectionIntro } from "@/components/ui/section-intro";
import { RevealGroup, RevealItem } from "@/components/ui/reveal";

const STEPS = ["Discover", "Select", "Order", "Pay", "Ship", "Track"];

/**
 * Section 09 — the dealer-facing platform capability chain. Conceptual, not a
 * status tracker (that's OrderTimeline, Section 10) — a plain step-and-arrow
 * row is the right device here, not a duplicate of OrderTimeline's state model.
 */
export function PlatformJourney() {
  return (
    <section className="border-t border-[var(--line)] bg-[var(--card)] px-4 py-20 md:px-8 md:py-28">
      <div className="mx-auto max-w-7xl">
        <SectionIntro
          index="09"
          eyebrow="The Platform"
          headline="A manufacturer. And a technology-enabled B2B supply platform."
          align="center"
          className="mb-14"
        />

        <RevealGroup className="flex flex-wrap items-center justify-center gap-x-2 gap-y-6">
          {STEPS.map((step, i) => (
            <div key={step} className="flex items-center gap-2">
              <RevealItem className="flex h-14 w-14 flex-shrink-0 items-center justify-center border border-[var(--line)] md:h-16 md:w-16">
                <span className="tnum font-mono text-xs font-bold text-[var(--red)]">{String(i + 1).padStart(2, "0")}</span>
              </RevealItem>
              <span className="text-sm font-bold uppercase tracking-tech text-[var(--ink)] md:text-base">{step}</span>
              {i < STEPS.length - 1 && <ArrowRight size={16} className="mx-2 flex-shrink-0 text-[var(--line)]" aria-hidden />}
            </div>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}
