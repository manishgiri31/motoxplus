import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About Us",
  description: "Learn about MotoXPlus India — our story, mission, and manufacturing capabilities.",
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Hero */}
      <section className="relative py-32 px-4 md:px-8 overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-red-950/20 rounded-full blur-[100px]" />
        </div>
        <div className="max-w-7xl mx-auto relative z-10 text-center">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="w-8 h-px bg-red-600" />
            <span className="text-red-500 text-xs font-semibold uppercase tracking-widest">About MotoXPlus</span>
            <div className="w-8 h-px bg-red-600" />
          </div>
          <h1 className="text-5xl md:text-7xl font-black text-[var(--text-primary)] tracking-tight mb-6">
            Built On <span className="text-gradient-red">Precision.</span><br />
            Driven By <span className="text-gradient-red">Purpose.</span>
          </h1>
          <p className="text-[var(--text-muted)] text-xl max-w-2xl mx-auto leading-relaxed">
            MOTOXPLUS India Private Limited is a leading manufacturer of premium two-wheeler spare parts,
            committed to delivering OEM-quality components across India.
          </p>
        </div>
      </section>

      {/* Story */}
      <section className="py-20 px-4 md:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-px bg-red-600" />
                <span className="text-red-500 text-xs font-semibold uppercase tracking-widest">Our Story</span>
              </div>
              <h2 className="text-4xl font-black text-[var(--text-primary)] mb-6 tracking-tight">
                From Workshop to<br />
                <span className="text-gradient-red">Manufacturing Leader.</span>
              </h2>
              <div className="space-y-4 text-[var(--text-muted)] leading-relaxed">
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
                  for fast, reliable delivery. We are committed to being the most trusted
                  name in automotive spare parts manufacturing in India.
                </p>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
              {[
                { value: "15+", label: "Years Experience" },
                { value: "500+", label: "Products" },
                { value: "18+", label: "States Covered" },
                { value: "500+", label: "Dealer Partners" },
                { value: "10K+", label: "Units/Month" },
                { value: "98%", label: "Quality Pass Rate" },
              ].map((stat) => (
                <div key={stat.label} className="glass border border-[var(--border-color)] rounded-sm p-6 text-center">
                  <div className="text-4xl font-black text-red-500 mb-2">{stat.value}</div>
                  <div className="text-[var(--text-muted)] text-sm uppercase tracking-wider">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-20 px-4 md:px-8 bg-[var(--bg-secondary)]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black text-[var(--text-primary)] tracking-tight mb-4">Our Core Values</h2>
            <p className="text-[var(--text-muted)] max-w-xl mx-auto">The principles that guide every decision we make.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                title: "Quality First",
                desc: "We never compromise on quality. Every component passes rigorous testing before it reaches our dealers.",
                icon: "◈",
              },
              {
                title: "Dealer Success",
                desc: "Our dealer partners are our growth engine. We invest in their success through support, tools, and pricing.",
                icon: "◉",
              },
              {
                title: "Innovation",
                desc: "Continuously improving our processes, materials, and product range to stay ahead of market needs.",
                icon: "⬡",
              },
            ].map((v) => (
              <div key={v.title} className="glass border border-[var(--border-color)] rounded-sm p-8">
                <div className="text-5xl text-red-800 font-black mb-6">{v.icon}</div>
                <h3 className="text-[var(--text-primary)] font-bold text-xl mb-3">{v.title}</h3>
                <p className="text-[var(--text-muted)] text-sm leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Vision */}
      <section className="py-20 px-4 md:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="glass border border-[var(--border-color)] rounded-sm p-12 text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-red-950/20 rounded-full blur-[80px]" />
            <div className="relative z-10">
              <div className="flex items-center justify-center gap-3 mb-6">
                <div className="w-8 h-px bg-red-600" />
                <span className="text-red-500 text-xs font-semibold uppercase tracking-widest">Future Vision</span>
                <div className="w-8 h-px bg-red-600" />
              </div>
              <h2 className="text-4xl font-black text-[var(--text-primary)] mb-6 tracking-tight">
                Beyond Two-Wheelers.
              </h2>
              <p className="text-[var(--text-muted)] text-lg max-w-3xl mx-auto leading-relaxed">
                While our current focus is two-wheeler spare parts, our roadmap includes expanding
                into three-wheeler and four-wheeler segments. We are building the infrastructure,
                quality systems, and dealer network to serve the entire Indian automotive aftermarket.
              </p>
              <div className="grid grid-cols-3 gap-8 mt-12 max-w-lg mx-auto">
                {[
                  { label: "Two-Wheeler", status: "Active" },
                  { label: "Three-Wheeler", status: "Coming Soon" },
                  { label: "Four-Wheeler", status: "Planned" },
                ].map((item) => (
                  <div key={item.label} className="text-center">
                    <div className={`text-xs font-semibold uppercase tracking-wider mb-1 ${item.status === "Active" ? "text-red-500" : "text-gray-600"}`}>
                      {item.status}
                    </div>
                    <div className="text-[var(--text-primary)] text-sm font-medium">{item.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
