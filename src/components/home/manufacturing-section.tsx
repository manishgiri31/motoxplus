"use client";

const processes = [
  {
    step: "01",
    title: "Raw Material Selection",
    description: "Only certified-grade alloys and composites meeting automotive standards.",
  },
  {
    step: "02",
    title: "Precision Manufacturing",
    description: "CNC machining and automated production lines for consistent dimensional accuracy.",
  },
  {
    step: "03",
    title: "Quality Inspection",
    description: "Multi-point inspection at every stage with CMM and non-destructive testing.",
  },
  {
    step: "04",
    title: "Surface Treatment",
    description: "Advanced coating and plating processes for corrosion and wear resistance.",
  },
  {
    step: "05",
    title: "Performance Testing",
    description: "Load, fatigue, and thermal testing to validate real-world performance.",
  },
  {
    step: "06",
    title: "Premium Packaging",
    description: "Secure, branded packaging that protects parts during transit.",
  },
];

export function ManufacturingSection() {
  return (
    <section className="py-24 px-4 md:px-8 bg-[var(--bg-primary)]">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-8 h-px bg-red-600" />
            <span className="text-red-500 text-xs font-semibold uppercase tracking-widest">
              Manufacturing Excellence
            </span>
            <div className="w-8 h-px bg-red-600" />
          </div>
          <h2 className="text-4xl md:text-5xl font-black text-[var(--text-primary)] tracking-tight mb-4">
            From Raw Metal to<br />
            <span className="text-gradient-red">Precision Part.</span>
          </h2>
          <p className="text-[var(--text-muted)] max-w-xl mx-auto">
            Our six-stage manufacturing process ensures every component that leaves
            our facility is built to perform.
          </p>
        </div>

        {/* Process grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {processes.map((process, i) => (
            <div
              key={process.step}
              className="group relative glass border border-[var(--border-color)] hover:border-red-900/40 rounded-sm p-6 transition-all duration-300"
            >
              {/* Step number */}
              <div className="absolute top-4 right-4 text-6xl font-black text-[var(--text-primary)]/5 group-hover:text-red-900/20 transition-colors leading-none">
                {process.step}
              </div>

              {/* Content */}
              <div className="relative z-10">
                <div className="w-8 h-0.5 bg-red-600 mb-6" />
                <h3 className="text-[var(--text-primary)] font-bold text-lg mb-3">{process.title}</h3>
                <p className="text-[var(--text-muted)] text-sm leading-relaxed">{process.description}</p>
              </div>

              {/* Hover accent */}
              <div className="absolute bottom-0 left-0 h-0.5 w-0 group-hover:w-full bg-red-600 transition-all duration-500" />
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="mt-16 glass border border-[var(--border-color)] rounded-sm p-8 md:p-12 flex flex-col md:flex-row items-center justify-between gap-8">
          <div>
            <h3 className="text-2xl md:text-3xl font-black text-[var(--text-primary)] mb-2">
              Interested in our manufacturing capabilities?
            </h3>
            <p className="text-[var(--text-muted)]">
              Schedule a factory visit or request our capability document.
            </p>
          </div>
          <a
            href="/contact"
            className="flex-shrink-0 bg-red-600 hover:bg-red-700 text-white font-bold px-8 py-4 rounded-sm transition-colors uppercase tracking-wider text-sm"
          >
            Get in Touch
          </a>
        </div>
      </div>
    </section>
  );
}
