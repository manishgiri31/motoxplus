import type { Metadata } from "next";
import { Gem, Target, Sparkles, ShieldCheck, BadgeCheck, FileCheck2, Factory } from "lucide-react";
import { Eyebrow, BlueprintGrid } from "@/components/ui/technical";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "About Us",
  description: "Learn about MotoXPlus India — our story, mission, and manufacturing capabilities.",
};

const stats = [
  { value: "15+", label: "Years Experience" },
  { value: "500+", label: "Products" },
  { value: "18+", label: "States Covered" },
  { value: "500+", label: "Dealer Partners" },
  { value: "10K+", label: "Units / Month" },
  { value: "98%", label: "Quality Pass Rate" },
];

const certifications = [
  { Icon: ShieldCheck, title: "ISO 9001:2015" },
  { Icon: BadgeCheck, title: "OEM Compatible" },
  { Icon: FileCheck2, title: "GST Registered" },
  { Icon: Factory, title: "Made in India" },
];

const processes = [
  { step: "01", title: "Raw Material Selection", description: "Only certified-grade alloys and composites meeting automotive standards." },
  { step: "02", title: "Precision Manufacturing", description: "CNC machining and automated production for consistent dimensional accuracy." },
  { step: "03", title: "Quality Inspection", description: "Multi-point inspection at every stage with CMM and non-destructive testing." },
  { step: "04", title: "Surface Treatment", description: "Advanced coating and plating processes for corrosion and wear resistance." },
  { step: "05", title: "Performance Testing", description: "Load, fatigue, and thermal testing to validate real-world performance." },
  { step: "06", title: "Premium Packaging", description: "Secure, branded packaging that protects parts during transit." },
];

const values = [
  { title: "Quality First", desc: "We never compromise on quality. Every component passes rigorous testing before it reaches our dealers.", Icon: Gem },
  { title: "Dealer Success", desc: "Our dealer partners are our growth engine. We invest in their success through support, tools, and pricing.", Icon: Target },
  { title: "Innovation", desc: "Continuously improving our processes, materials, and product range to stay ahead of market needs.", Icon: Sparkles },
];

const roadmap = [
  { label: "Two-Wheeler", status: "Active", active: true },
  { label: "Three-Wheeler", status: "Coming Soon", active: false },
  { label: "Four-Wheeler", status: "Planned", active: false },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[var(--paper)]">
      {/* Hero */}
      <section className="relative py-24 md:py-28 px-4 md:px-8 overflow-hidden">
        <BlueprintGrid fade="radial" className="opacity-60" />
        <div className="max-w-3xl mx-auto relative z-10 text-center">
          <Eyebrow className="justify-center mb-6">About MotoXplus</Eyebrow>
          <h1 className="font-display text-4xl md:text-6xl font-bold text-[var(--ink)] tracking-tight mb-6 leading-[1.05]">
            Built on <span className="text-[var(--red)]">precision.</span><br />
            Driven by <span className="text-[var(--red)]">purpose.</span>
          </h1>
          <p className="text-[var(--muted)] text-lg leading-relaxed">
            MOTOXPLUS India Private Limited is a leading manufacturer of premium two-wheeler
            spare parts, committed to delivering OEM-quality components across India.
          </p>
        </div>
      </section>

      {/* Story + stats */}
      <section className="py-16 md:py-20 px-4 md:px-8 border-t border-[var(--line)]">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-start">
            <div>
              <Eyebrow className="mb-5">Our Story</Eyebrow>
              <h2 className="font-display text-3xl font-bold text-[var(--ink)] mb-6 tracking-tight">
                From workshop to manufacturing leader.
              </h2>
              <div className="space-y-4 text-[var(--muted)] leading-relaxed">
                <p>
                  MotoXPlus India was founded with a singular vision: to give Indian two-wheeler
                  owners access to genuine-quality spare parts at accessible prices. What started
                  as a small workshop serving local mechanics has grown into a full-scale
                  manufacturing operation.
                </p>
                <p>
                  Today, we manufacture 500+ SKUs covering brake systems, engine components,
                  suspension, and electrical systems — all engineered to OEM specifications and
                  tested rigorously before they reach our dealers.
                </p>
                <p>
                  Our dealer network spans 18+ states, with a logistics infrastructure built
                  for fast, reliable delivery.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-px bg-[var(--line)] border border-[var(--line)]">
              {stats.map((stat) => (
                <Card key={stat.label} pad="lg" className="rounded-none border-0 text-center">
                  <div className="tnum font-display text-3xl font-bold text-[var(--red)] mb-1.5">{stat.value}</div>
                  <div className="text-[var(--muted)] text-xs uppercase tracking-wider font-semibold">{stat.label}</div>
                </Card>
              ))}
            </div>
          </div>

          {/* Certifications strip */}
          <div className="mt-14 pt-10 border-t border-[var(--line)] flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
            {certifications.map((cert) => (
              <div key={cert.title} className="flex items-center gap-3">
                <cert.Icon size={18} className="text-[var(--red)]" />
                <span className="text-[var(--ink)] text-sm font-semibold">{cert.title}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Manufacturing process */}
      <section className="py-16 md:py-20 px-4 md:px-8 bg-[var(--card)] border-t border-[var(--line)]">
        <div className="max-w-7xl mx-auto">
          <div className="mb-10">
            <Eyebrow className="mb-4">Manufacturing Excellence</Eyebrow>
            <h2 className="font-display text-3xl font-bold text-[var(--ink)] tracking-tight mb-3">
              From raw metal to precision part.
            </h2>
            <p className="text-[var(--muted)] max-w-xl leading-relaxed">
              Our six-stage manufacturing process ensures every component that leaves
              our facility is built to perform.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-[var(--line)] border border-[var(--line)]">
            {processes.map((process) => (
              <Card key={process.step} pad="lg" className="rounded-none border-0">
                <div className="flex items-center gap-3 mb-4">
                  <span className="tnum font-mono text-[var(--red)] text-xs font-bold">{process.step}</span>
                  <span className="h-px flex-1 bg-[var(--line)]" />
                </div>
                <h3 className="text-[var(--ink)] font-bold text-base mb-2">{process.title}</h3>
                <p className="text-[var(--muted)] text-sm leading-relaxed">{process.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-16 md:py-20 px-4 md:px-8 border-t border-[var(--line)]">
        <div className="max-w-7xl mx-auto">
          <div className="mb-10">
            <Eyebrow className="mb-4">Core Values</Eyebrow>
            <h2 className="font-display text-3xl font-bold text-[var(--ink)] tracking-tight">Our core values.</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-[var(--line)] border border-[var(--line)]">
            {values.map((v) => (
              <Card key={v.title} pad="lg" className="rounded-none border-0">
                <v.Icon size={22} className="text-[var(--red)] mb-5" />
                <h3 className="text-[var(--ink)] font-bold text-lg mb-2.5">{v.title}</h3>
                <p className="text-[var(--muted)] text-sm leading-relaxed">{v.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Vision */}
      <section className="py-16 md:py-20 px-4 md:px-8 bg-[var(--card)] border-t border-[var(--line)]">
        <div className="max-w-3xl mx-auto text-center">
          <Eyebrow className="justify-center mb-5">Future Vision</Eyebrow>
          <h2 className="font-display text-3xl font-bold text-[var(--ink)] mb-5 tracking-tight">
            Beyond two-wheelers.
          </h2>
          <p className="text-[var(--muted)] leading-relaxed mb-12">
            While our current focus is two-wheeler spare parts, our roadmap includes expanding
            into three-wheeler and four-wheeler segments — building the infrastructure, quality
            systems, and dealer network to serve the entire Indian automotive aftermarket.
          </p>
          <div className="flex items-stretch justify-center max-w-md mx-auto">
            {roadmap.map((item, i) => (
              <div key={item.label} className={`flex-1 px-4 ${i > 0 ? "border-l border-[var(--line)]" : ""}`}>
                <div className={`text-[10px] font-bold uppercase tracking-wider mb-1.5 ${item.active ? "text-[var(--red)]" : "text-[var(--muted)]"}`}>
                  {item.status}
                </div>
                <div className="text-[var(--ink)] text-sm font-semibold">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
