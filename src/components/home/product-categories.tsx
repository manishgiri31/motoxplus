import { SectionIntro } from "@/components/ui/section-intro";
import { IndustrialCard } from "@/components/ui/industrial-card";
import { Img } from "@/components/ui/media";
import { Hatch } from "@/components/ui/technical";
import { Reveal } from "@/components/ui/reveal";

export interface HomeCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  productCount: number;
}

/** Section 05 — real category data as large editorial tiles, not an e-commerce grid. */
export function ProductCategories({ categories }: { categories: HomeCategory[] }) {
  if (categories.length === 0) return null;

  return (
    <section className="border-t border-[var(--line)] bg-[var(--paper)] px-4 py-20 md:px-8 md:py-28">
      <div className="mx-auto max-w-7xl">
        <SectionIntro index="05" eyebrow="Product Range" headline="Built for every system." className="mb-14" />

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {categories.map((cat, i) => (
            <Reveal key={cat.id} delay={i * 0.05}>
              <IndustrialCard
                index={String(i + 1).padStart(2, "0")}
                title={cat.name}
                description={cat.description ?? undefined}
                href={`/products?category=${cat.slug}`}
                ctaLabel="Explore Category"
                media={
                  <div className="relative aspect-[4/3] overflow-hidden bg-[var(--surface-1)]">
                    {cat.image ? (
                      <Img
                        src={cat.image}
                        alt={cat.name}
                        fill
                        sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                        className="object-cover"
                      />
                    ) : (
                      <Hatch className="opacity-40" />
                    )}
                  </div>
                }
                metadata={
                  cat.productCount > 0 ? (
                    <span className="font-mono text-xs font-semibold text-[var(--red)]">{cat.productCount}+ SKUs</span>
                  ) : undefined
                }
              />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
