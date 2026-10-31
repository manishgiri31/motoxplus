import type { Metadata } from "next";
import { Gem, Target, Sparkles, ShieldCheck, BadgeCheck, FileCheck2, Factory } from "lucide-react";
import { Container } from "@/components/store/container";
import { Reveal } from "@/components/store/reveal";
import { StoreButton } from "@/components/store/button";

export const metadata: Metadata = {
  title: "About Us",
  description: "Learn about MotoXPlus India — our story, mission, and manufacturing capabilities.",
};

const stats = [
  { value: "15+", label: "Years of experience" },
  { value: "500+", label: "Products" },
  { value: "18+", label: "States covered" },
  { value: "500+", label: "Dealer partners" },
  { value: "10K+", label: "Units a month" },
  { value: "98%", label: "Quality pass rate" },
];

const certifications = [
  { Icon: ShieldCheck, title: "ISO 9001:2015" },
  { Icon: BadgeCheck, title: "OEM compatible" },
  { Icon: FileCheck2, title: "GST registered" },
  { Icon: Factory, title: "Made in India" },
];

const processes = [
  { step: "01", title: "Raw material selection", description: "Only certified-grade alloys and composites meeting automotive standards." },
  { step: "02", title: "Precision manufacturing", description: "CNC machining and automated production for consistent dimensional accuracy." },
  { step: "03", title: "Quality inspection", description: "Multi-point inspection at every stage with CMM and non-destructive testing." },
  { step: "04", title: "Surface treatment", description: "Advanced coating and plating processes for corrosion and wear resistance." },
  { step: "05", title: "Performance testing", description: "Load, fatigue, and thermal testing to validate real-world performance." },
  { step: "06", title: "Premium packaging", description: "Secure, branded packaging that protects parts during transit." },
];

const values = [
  { title: "Quality first", desc: "We never compromise on quality. Every component passes rigorous testing before it reaches our dealers.", Icon: Gem },
  { title: "Dealer success", desc: "Our dealer partners are our growth engine. We invest in their success through support, tools, and pricing.", Icon: Target },
  { title: "Innovation", desc: "Continuously improving our processes, materials, and product range to stay ahead of market needs.", Icon: Sparkles },
];

const roadmap = [
  { label: "Two-wheeler", status: "Available now", active: true },
  { label: "Three-wheeler", status: "Coming soon", active: false },
  { label: "Four-wheeler", status: "Planned", active: false },
];

const h2 = "text-[clamp(28px,4vw,40px)] font-semibold leading-[1.1] tracking-[-0.01em]";
const section = "py-[clamp(48px,8vw,120px)]";

export default function AboutPage() {
  return (
    <div className="bg-white font-store text-17 tracking-[-0.022em] text-store-ink">
      {/* Hero */}
      <section className="px-4 pb-[clamp(40px,6vw,80px)] pt-[clamp(56px,9vw,120px)] text-center">
        <Reveal>
          <p className="text-17 font-semibold text-store-accent">About MOTOXPLUS</p>
          <h1 className="mx-auto mt-2 max-w-[14ch] text-[clamp(40px,7vw,80px)] font-semibold leading-[1.05] tracking-[-0.015em]">
            Built on precision. Driven by purpose.
          </h1>
          <p className="mx-auto mt-5 max-w-[34ch] text-[clamp(19px,2.4vw,28px)] leading-[1.17] text-store-ink-2">
            A leading manufacturer of premium two-wheeler spare parts, delivering OEM-quality components across India.
          </p>
        </Reveal>
      </section>

      {/* Story */}
      <section className={`${section} bg-store-bg-alt`}>
        <Container className="max-w-narrow">
          <Reveal>
            <h2 className={h2}>From workshop to manufacturing leader.</h2>
            <div className="mt-6 space-y-5 text-[19px] leading-[1.45] text-store-ink-2">
              <p>
                MotoXPlus India was founded with a singular vision: to give Indian two-wheeler owners access to
                genuine-quality spare parts at accessible prices. What started as a small workshop serving local
                mechanics has grown into a full-scale manufacturing operation.
              </p>
              <p>
                Today, we manufacture 500+ SKUs covering brake systems, engine components, suspension, and electrical
                systems — all engineered to OEM specifications and tested rigorously before they reach our dealers.
              </p>
              <p>Our dealer network spans 18+ states, with a logistics infrastructure built for fast, reliable delivery.</p>
            </div>
          </Reveal>
          <ul className="mt-10 flex flex-wrap gap-x-8 gap-y-4">
            {certifications.map(({ Icon, title }) => (
              <li key={title} className="flex items-center gap-2.5 text-17 font-semibold">
                <Icon size={20} className="text-store-accent" aria-hidden />
                {title}
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* Numbers */}
      <section aria-label="MOTOXPLUS in numbers" className={`${section} bg-store-bg-inverse text-store-ink-inverse`}>
        <Container>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-12 bp-tab:grid-cols-3">
            {stats.map((s) => (
              <Reveal key={s.label}>
                <dd className="tnum text-[clamp(40px,6vw,64px)] font-semibold leading-[1.06] tracking-[-0.015em]">{s.value}</dd>
                <dt className="mt-1 text-17 text-white/70">{s.label}</dt>
              </Reveal>
            ))}
          </dl>
        </Container>
      </section>

      {/* Process */}
      <section className={section}>
        <Container>
          <Reveal>
            <h2 className={h2}>From raw metal to precision part.</h2>
            <p className="mt-3 max-w-[40ch] text-[19px] leading-[1.35] text-store-ink-2">
              A six-stage process makes sure every component that leaves our facility is built to perform.
            </p>
          </Reveal>
          <ol className="mt-12 grid gap-5 bp-tab:grid-cols-2 bp-lg:grid-cols-3">
            {processes.map((p) => (
              <li key={p.step} className="rounded-store-card bg-store-bg-alt p-8">
                <span className="tnum text-14 font-semibold text-store-accent">{p.step}</span>
                <h3 className="mt-2 text-[21px] font-semibold leading-[1.19]">{p.title}</h3>
                <p className="mt-2 text-17 text-store-ink-2">{p.description}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      {/* Values */}
      <section className={`${section} bg-store-bg-alt`}>
        <Container>
          <Reveal>
            <h2 className={h2}>What we stand for.</h2>
          </Reveal>
          <div className="mt-12 grid gap-5 bp-tab:grid-cols-3">
            {values.map((v) => (
              <div key={v.title} className="rounded-store-card bg-white p-8">
                <v.Icon size={28} className="text-store-accent" aria-hidden />
                <h3 className="mt-5 text-[21px] font-semibold leading-[1.19]">{v.title}</h3>
                <p className="mt-2 text-17 text-store-ink-2">{v.desc}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* Vision */}
      <section className={`${section} text-center`}>
        <Container className="max-w-narrow">
          <Reveal>
            <h2 className={h2}>Beyond two-wheelers.</h2>
            <p className="mt-4 text-[19px] leading-[1.45] text-store-ink-2">
              While our current focus is two-wheeler spare parts, our roadmap includes three-wheeler and four-wheeler
              segments — building the infrastructure, quality systems, and dealer network to serve the entire Indian
              automotive aftermarket.
            </p>
          </Reveal>
          <ul className="mt-10 flex flex-wrap justify-center gap-3">
            {roadmap.map((r) => (
              <li
                key={r.label}
                className={
                  r.active
                    ? "rounded-store-pill bg-store-accent px-5 py-2.5 text-17 text-white"
                    : "rounded-store-pill bg-store-bg-alt px-5 py-2.5 text-17 text-store-ink-2"
                }
              >
                {r.label} <span className="opacity-70">· {r.status}</span>
              </li>
            ))}
          </ul>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <StoreButton href="/become-dealer">Become a dealer</StoreButton>
            <StoreButton href="/contact" variant="secondary">
              Contact us
            </StoreButton>
          </div>
        </Container>
      </section>
    </div>
  );
}
