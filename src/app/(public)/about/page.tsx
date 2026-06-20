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
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-red-950/18 rounded-full blur-[110px]" />
          <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-red-950/10 rounded-full blur-[80px]" />
        </div>
        <div className="max-w-7xl mx-auto relative z-10 text-center">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="w-8 h-px bg-red-600" />
            <span className="text-red-500 text-xs font-semibold uppercase tracking-widest">About MotoXPlus</span>
            <div className="w-8 h-px bg-red-600" />
          </div>
          <h1 className="text-5xl md:text-7xl font-black text-[var(--text-primary)] tracking-tight mb-6 leading-[0.95]">
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
                <div key={stat.label} className="glass border border-[var(--border-color)] rounded-2xl p-6 text-center hover:border-red-900/40 transition-colors card-hover">
                  <div className="text-4xl font-black text-red-500 mb-2">{stat.value}</div>
                  <div className="text-[var(--text-muted)] text-xs uppercase tracking-wider font-semibold">{stat.label}</div>
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
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="w-8 h-px bg-red-600" />
              <span className="text-red-500 text-xs font-semibold uppercase tracking-widest">Core Values</span>
              <div className="w-8 h-px bg-red-600" />
            </div>
            <h2 className="text-4xl font-black text-[var(--text-primary)] tracking-tight mb-4">Our Core Values</h2>
            <p className="text-[var(--text-muted)] max-w-xl mx-auto">The principles that guide every decision we make.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              {
                title: "Quality First",
                desc: "We never compromise on quality. Every component passes rigorous testing before it reaches our dealers.",
                icon: "◈",
                color: "text-red-500",
                bg: "bg-red-900/10",
              },
              {
                title: "Dealer Success",
                desc: "Our dealer partners are our growth engine. We invest in their success through support, tools, and pricing.",
                icon: "◉",
                color: "text-blue-400",
                bg: "bg-blue-900/10",
              },
              {
                title: "Innovation",
                desc: "Continuously improving our processes, materials, and product range to stay ahead of market needs.",
                icon: "⬡",
                color: "text-purple-400",
                bg: "bg-purple-900/10",
              },
            ].map((v) => (
              <div key={v.title} className="glass border border-[var(--border-color)] rounded-2xl p-8 hover:border-red-900/30 transition-all card-hover">
                <div className={`w-14 h-14 ${v.bg} rounded-2xl flex items-center justify-center mb-6`}>
                  <span className={`text-3xl ${v.color}`}>{v.icon}</span>
                </div>
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
          <div className="glass border border-[var(--border-color)] rounded-2xl p-10 md:p-14 text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-red-950/15 rounded-full blur-[90px] pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-60 h-60 bg-red-950/10 rounded-full blur-[70px] pointer-events-none" />
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
              <div className="flex flex-row items-center justify-center gap-0 mt-12 max-w-md mx-auto">
                {[
                  { label: "Two-Wheeler", status: "Active", active: true },
                  { label: "Three-Wheeler", status: "Coming Soon", active: false },
                  { label: "Four-Wheeler", status: "Planned", active: false },
                ].map((item, i) => (
                  <div key={item.label} className="flex items-center flex-1">
                    <div className="text-center flex-1">
                      <div className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${item.active ? "text-red-500" : "text-[var(--text-muted)]"}`}>
                        {item.status}
                      </div>
                      <div className="text-[var(--text-primary)] text-sm font-semibold">{item.label}</div>
                    </div>
                    {i < 2 && <div className="w-px h-8 bg-[var(--border-color)]" />}
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
