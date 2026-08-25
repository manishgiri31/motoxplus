import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Eyebrow, BlueprintGrid, CornerFrame } from "@/components/ui/technical";

interface Props {
  productCount?: number;
  categoryCount?: number;
}

export function HeroSection({ productCount = 700, categoryCount = 15 }: Props) {
  const stats = [
    { value: `${productCount}+`, label: "Products" },
    { value: `${categoryCount}+`, label: "Categories" },
    { value: "18+", label: "States Served" },
  ];

  return (
    <section className="relative overflow-hidden bg-[var(--paper)] pt-40 pb-20 md:pt-48 md:pb-28">
      <BlueprintGrid fade="bottom" className="opacity-70" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-8">
        <CornerFrame size={16} weight={1} className="px-2">
          <div className="max-w-3xl">
            <Eyebrow className="mb-8">Premium Automotive Parts Manufacturer</Eyebrow>

            <h1 className="font-display text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.02] mb-6">
              <span className="block text-[var(--ink)]">Engineered for</span>
              <span className="block text-[var(--red)]">reliability.</span>
            </h1>

            <p className="text-[var(--muted)] text-base md:text-lg leading-relaxed max-w-xl mb-10">
              OEM-compatible spare parts for two-wheelers, manufactured with precision
              engineering and tested to the highest standards — backed by a dealer
              network in 18+ states.
            </p>

            <div className="flex flex-col sm:flex-row items-start gap-3 mb-16">
              <Button asChild variant="brand" size="lg">
                <Link href="/products" className="group">
                  Explore Products
                  <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </Button>
              <Button asChild variant="ghost" size="lg">
                <Link href="/become-dealer">Become a Dealer</Link>
              </Button>
            </div>

            <dl className="flex items-stretch">
              {stats.map((stat, i) => (
                <div
                  key={stat.label}
                  className={`pr-8 sm:pr-12 ${i > 0 ? "border-l border-[var(--line)] pl-8 sm:pl-12" : ""}`}
                >
                  <dt className="text-[var(--muted)] text-[10px] uppercase tracking-widest mb-1.5">{stat.label}</dt>
                  <dd className="tnum font-display text-3xl md:text-4xl font-bold text-[var(--ink)]">{stat.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </CornerFrame>
      </div>
    </section>
  );
}
