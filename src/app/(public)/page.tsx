import Link from "next/link";
import { Container } from "@/components/store/container";
import { Hero } from "@/components/store/hero";
import { ProductCard } from "@/components/store/product-card";
import { CardScroller, ScrollerItem } from "@/components/store/card-scroller";
import { Reveal } from "@/components/store/reveal";
import { StoreButton } from "@/components/store/button";
import { getFeaturedProducts, getProducts } from "@/lib/store/products";

const h2 = "text-[clamp(28px,4vw,40px)] font-semibold leading-[1.1]";

export default function HomePage() {
  const featured = getFeaturedProducts().slice(0, 2);
  const latest = getProducts();

  return (
    <div className="bg-white font-store text-17 tracking-[-0.022em] text-store-ink">
      <Hero />

      <section aria-label="Featured" className="py-[clamp(48px,8vw,120px)]">
        <Container className="grid gap-5 bp-tab:grid-cols-2">
          {featured.map((p, i) => (
            <Reveal key={p.id} delay={i * 0.08} className="h-full">
              <ProductCard p={p} dark={i % 2 === 1} />
            </Reveal>
          ))}
        </Container>
      </section>

      <section aria-labelledby="latest" className="pb-[clamp(48px,8vw,120px)]">
        <Container className="max-w-page">
          <div className="flex items-baseline justify-between gap-4 px-6">
            <h2 id="latest" className={h2}>
              The latest.
            </h2>
            <Link href="/products" className="shrink-0 rounded-sm text-17 text-store-link hover:underline focus-visible:outline-store-accent">
              Shop all &rsaquo;
            </Link>
          </div>
          <div className="mt-8">
            <CardScroller label="Latest products">
              {latest.map((p) => (
                <ScrollerItem key={p.id}>
                  <ProductCard p={p} />
                </ScrollerItem>
              ))}
            </CardScroller>
          </div>
        </Container>
      </section>

      <section aria-labelledby="dealers" className="bg-store-bg-inverse py-[clamp(48px,8vw,120px)] text-center text-store-ink-inverse">
        <Container>
          <Reveal>
            <h2 id="dealers" className={h2}>
              Stock MOTOXPLUS.
            </h2>
            <p className="mt-2 text-[clamp(19px,2.4vw,24px)] leading-[1.17] text-white/70">
              Join 500+ dealers across India. Wholesale pricing and priority stock.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
              <StoreButton href="/become-dealer">Become a dealer</StoreButton>
              <Link href="/contact" className="rounded-sm text-17 text-store-link-dark hover:underline focus-visible:outline-store-accent">
                Contact sales &rsaquo;
              </Link>
            </div>
          </Reveal>
        </Container>
      </section>
    </div>
  );
}
