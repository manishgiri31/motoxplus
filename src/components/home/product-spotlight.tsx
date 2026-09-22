import { SectionIntro } from "@/components/ui/section-intro";
import { ProductShowcase, type ProductShowcaseItem } from "@/components/products/product-showcase";

/** Section 06 — real products, presented as engineered components rather than merchandise. */
export function ProductSpotlight({ products }: { products: ProductShowcaseItem[] }) {
  if (products.length === 0) return null;

  return (
    <section className="border-t border-[var(--line)] bg-[var(--paper)] px-4 py-20 md:px-8 md:py-28">
      <div className="mx-auto max-w-7xl">
        <SectionIntro index="06" eyebrow="The Range" headline="Engineered components, not merchandise." className="mb-16" />
        <div className="flex flex-col gap-20">
          {products.map((product, i) => (
            <ProductShowcase key={product.id} product={product} reverse={i % 2 === 1} />
          ))}
        </div>
      </div>
    </section>
  );
}
