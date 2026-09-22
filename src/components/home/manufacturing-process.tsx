import { SectionIntro } from "@/components/ui/section-intro";
import { ManufacturingTimeline } from "@/components/manufacturing/manufacturing-timeline";
import type { ManufacturingStageData } from "@/components/manufacturing/manufacturing-stage";

const STAGES: ManufacturingStageData[] = [
  {
    number: "01",
    eyebrow: "Stage 01",
    title: "Raw Material",
    description: "Material selection and incoming inspection before a single part is machined.",
    media: "manufacturing.stage.raw-material",
  },
  {
    number: "02",
    eyebrow: "Stage 02",
    title: "Precision Manufacturing",
    description: "CNC and precision machining to exact tolerances, in-house.",
    media: "manufacturing.stage.precision",
  },
  {
    number: "03",
    eyebrow: "Stage 03",
    title: "Quality Control",
    description: "Multi-point dimensional and visual inspection at every stage of production.",
    media: "manufacturing.stage.quality-control",
  },
  {
    number: "04",
    eyebrow: "Stage 04",
    title: "Surface Treatment",
    description: "Finishing and coating processes for corrosion and wear resistance.",
    media: "manufacturing.stage.surface-treatment",
  },
  {
    number: "05",
    eyebrow: "Stage 05",
    title: "Performance Testing",
    description: "Functional and performance validation before a part is approved for dispatch.",
    media: "manufacturing.stage.performance-testing",
  },
  {
    number: "06",
    eyebrow: "Stage 06",
    title: "Packaging",
    description: "Final inspection and dealer-ready packaging for dispatch.",
    media: "manufacturing.stage.packaging",
  },
];

/** Section 04 — the six-stage factory-tour timeline. */
export function ManufacturingProcess() {
  return (
    <section className="border-t border-[var(--line)] bg-[var(--paper)] px-4 py-20 md:px-8 md:py-28">
      <div className="mx-auto max-w-7xl">
        <SectionIntro index="04" eyebrow="Process" headline="From raw material to road-ready." className="mb-16" />
        <ManufacturingTimeline stages={STAGES} />
      </div>
    </section>
  );
}
