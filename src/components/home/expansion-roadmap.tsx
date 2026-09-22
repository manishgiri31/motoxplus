import { SectionIntro } from "@/components/ui/section-intro";
import { Badge } from "@/components/ui/badge";
import { RevealGroup, RevealItem } from "@/components/ui/reveal";
import { ArrowRight } from "lucide-react";

const ROADMAP = [
  { label: "2-Wheeler", tag: "Active", tone: "ok" as const, desc: "500+ SKUs shipping today across the dealer network." },
  { label: "3-Wheeler", tag: "Next", tone: "info" as const, desc: "Aftermarket segment in engineering development." },
  { label: "4-Wheeler", tag: "Planned", tone: "neutral" as const, desc: "Longer-term roadmap — not yet in production." },
];

/** Section 12 — the expansion roadmap. Deliberately labels each stage's real
 *  status (data-tone driven) so "planned" is never confused with "available now". */
export function ExpansionRoadmap() {
  return (
    <section className="border-t border-[var(--line)] bg-[var(--card)] px-4 py-20 md:px-8 md:py-28">
      <div className="mx-auto max-w-7xl">
        <SectionIntro index="12" eyebrow="Expansion" headline="An engineering roadmap, not a rebrand." align="center" className="mb-14" />

        <RevealGroup className="grid grid-cols-1 gap-px border border-[var(--line)] bg-[var(--line)] sm:grid-cols-3">
          {ROADMAP.map((stage, i) => (
            <RevealItem key={stage.label} className="relative flex flex-col gap-4 bg-[var(--card)] p-8">
              <div className="flex items-center justify-between">
                <span className="tnum font-mono text-xs font-bold text-[var(--muted)]">{String(i + 1).padStart(2, "0")}</span>
                <Badge tone={stage.tone}>{stage.tag}</Badge>
              </div>
              <h3 className="font-display text-2xl font-bold tracking-tight text-[var(--ink)]">{stage.label}</h3>
              <p className="text-sm leading-relaxed text-[var(--muted)]">{stage.desc}</p>
              {i < ROADMAP.length - 1 && (
                <ArrowRight
                  size={18}
                  aria-hidden
                  className="absolute right-0 top-1/2 hidden -translate-y-1/2 translate-x-1/2 text-[var(--line)] sm:block"
                />
              )}
            </RevealItem>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}
