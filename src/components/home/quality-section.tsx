import { ShieldCheck, BadgeCheck, FileCheck2, Factory } from "lucide-react";
import { SectionIntro } from "@/components/ui/section-intro";
import { VideoPlate } from "@/components/ui/video-plate";
import { Rule } from "@/components/ui/technical";
import { Reveal, RevealGroup, RevealItem } from "@/components/ui/reveal";
import { MetricCounter } from "@/components/ui/metric-counter";

const CHECKPOINTS = ["Material Inspection", "Dimensional Check", "Surface Inspection", "Performance Test", "Final QC"];

const CERTIFICATIONS = [
  { Icon: ShieldCheck, label: "ISO 9001:2015" },
  { Icon: BadgeCheck, label: "OEM Compatible" },
  { Icon: FileCheck2, label: "GST Registered" },
  { Icon: Factory, label: "Made in India" },
];

/** Section 07 — quality control, presented as a documented process, not a marketing claim. */
export function QualitySection() {
  return (
    <section className="border-t border-[var(--line)] bg-[var(--card)] px-4 py-20 md:px-8 md:py-28">
      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-1 gap-14 lg:grid-cols-2 lg:items-center">
          <Reveal>
            <SectionIntro
              index="07"
              eyebrow="Quality Control"
              headline={
                <>
                  Built to spec.
                  <br />
                  <span className="text-[var(--red)]">Checked at every stage.</span>
                </>
              }
              className="mb-10"
            />

            <div className="flex flex-col">
              {CHECKPOINTS.map((step, i) => (
                <div key={step}>
                  <div className="flex items-center gap-3 py-2.5">
                    <span className="tnum font-mono text-xs font-bold text-[var(--red)]">{String(i + 1).padStart(2, "0")}</span>
                    <span className="text-sm font-semibold text-[var(--ink)]">{step}</span>
                  </div>
                  {i < CHECKPOINTS.length - 1 && <Rule inset className="ml-[26px] w-auto" />}
                </div>
              ))}
            </div>

            <RevealGroup className="mt-10 flex flex-wrap gap-x-10 gap-y-6 border-t border-[var(--line)] pt-8">
              {CERTIFICATIONS.map((cert) => (
                <RevealItem key={cert.label} className="flex items-center gap-2.5">
                  <cert.Icon size={17} className="text-[var(--red)]" />
                  <span className="text-sm font-semibold text-[var(--ink)]">{cert.label}</span>
                </RevealItem>
              ))}
            </RevealGroup>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="relative">
              <VideoPlate id="manufacturing.stage.quality-control" />
              <div className="absolute -bottom-6 -right-6 hidden bg-[var(--paper)] p-5 shadow-[var(--elev-3)] sm:block">
                <MetricCounter value={98} suffix="%" label="Quality Pass Rate" accent />
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
