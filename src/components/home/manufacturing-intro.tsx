import { VideoPlate } from "@/components/ui/video-plate";
import { Eyebrow, TechnicalLabel } from "@/components/ui/technical";
import { Reveal } from "@/components/ui/reveal";

const ANNOTATIONS = ["Precision Manufacturing", "In-House Process", "Controlled QC"];

/** Section 02 — editorial split: statement copy (left) + the factory-reel video (right). */
export function ManufacturingIntro() {
  return (
    <section className="border-t border-[var(--line)] bg-[var(--paper)] px-4 py-20 md:px-8 md:py-28">
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-14 lg:grid-cols-2">
        <Reveal>
          <Eyebrow index="02" className="mb-6">
            Manufacturing
          </Eyebrow>
          <h2 className="font-display text-3xl font-bold leading-[1.05] tracking-tight text-[var(--ink)] md:text-4xl lg:text-5xl">
            Precision is not a feature.
            <br />
            <span className="text-[var(--red)]">It is the process.</span>
          </h2>
          <p className="mt-6 max-w-md text-base leading-relaxed text-[var(--muted)]">
            MotoXPlus manufactures automotive spare parts through controlled production —
            material selection, precision machining, multi-point inspection, surface
            treatment and performance testing — before a single part reaches a dealer.
          </p>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="relative">
            <VideoPlate id="home.factory.reel" controls="minimal" />
            <div className="mt-4 flex flex-wrap gap-2">
              {ANNOTATIONS.map((label) => (
                <TechnicalLabel key={label}>{label}</TechnicalLabel>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
