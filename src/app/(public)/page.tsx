import { prisma } from "@/lib/prisma";
import type { SpecRow } from "@/components/ui/technical";
import type { ProductShowcaseItem, ProductShowcaseAvailability } from "@/components/products/product-showcase";
import type { HomeCategory } from "@/components/home/product-categories";

import { CinematicHero } from "@/components/home/cinematic-hero";
import { ManufacturingIntro } from "@/components/home/manufacturing-intro";
import { ProductionMetrics } from "@/components/home/production-metrics";
import { ManufacturingProcess } from "@/components/home/manufacturing-process";
import { ProductCategories } from "@/components/home/product-categories";
import { ProductSpotlight } from "@/components/home/product-spotlight";
import { QualitySection } from "@/components/home/quality-section";
import { DealerNetworkSection } from "@/components/home/dealer-network-section";
import { PlatformJourney } from "@/components/home/platform-journey";
import { OrderLifecycleSection } from "@/components/home/order-lifecycle-section";
import { MadeInIndia } from "@/components/home/made-in-india";
import { ExpansionRoadmap } from "@/components/home/expansion-roadmap";
import { FinalCta } from "@/components/home/final-cta";

const STOCK_STATUS_MAP: Record<string, ProductShowcaseAvailability> = {
  IN_STOCK: "in-stock",
  FEW_LEFT: "low-stock",
  OUT_OF_STOCK: "out-of-stock",
};

// Marketing constants that have no backing data model (no "units produced"
// or "QC pass rate" table exists) — supplied as fixed copy, not computed.
// SKU / dealer / state counts below ARE computed live from Prisma.
const FALLBACK_DEALER_COUNT = 500;
const FALLBACK_STATE_COUNT = 18;

export default async function HomePage() {
  let skuCount = 0;
  let dealerCount = FALLBACK_DEALER_COUNT;
  let stateCount = FALLBACK_STATE_COUNT;
  let categories: HomeCategory[] = [];
  let showcaseProducts: ProductShowcaseItem[] = [];

  try {
    const [productCount, categoriesRaw, activeDealers, productsRaw] = await Promise.all([
      prisma.product.count({ where: { isActive: true } }),
      prisma.category.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        take: 6,
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          image: true,
          _count: { select: { products: { where: { isActive: true } } } },
        },
      }),
      prisma.dealer.findMany({ where: { status: "ACTIVE" }, select: { state: true } }),
      prisma.product.findMany({
        where: { isActive: true },
        orderBy: [{ source: "asc" }, { createdAt: "desc" }],
        take: 2,
        include: {
          category: true,
          productImages: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }], take: 1 },
        },
      }),
    ]);

    skuCount = productCount;
    categories = categoriesRaw.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      image: c.image,
      productCount: c._count.products,
    }));

    if (activeDealers.length > 0) {
      dealerCount = activeDealers.length;
      const distinctStates = new Set(activeDealers.map((d) => d.state).filter(Boolean)).size;
      if (distinctStates > 0) stateCount = distinctStates;
    }

    showcaseProducts = productsRaw
      .map((p): ProductShowcaseItem | null => {
        const image = p.productImages[0]?.imageUrl ?? p.images[0] ?? null;
        const specs: SpecRow[] = [];
        if (p.partNumber) specs.push({ label: "Part Number", value: p.partNumber });
        if (p.oemNumber) specs.push({ label: "OEM Number", value: p.oemNumber });
        if (p.warranty) specs.push({ label: "Warranty", value: p.warranty });
        if (p.countryOfOrigin) specs.push({ label: "Country of Origin", value: p.countryOfOrigin });

        return {
          id: p.id,
          name: p.name,
          sku: p.sku,
          category: p.category?.name,
          application: p.compatibility.length > 0 ? `Compatible with ${p.compatibility.slice(0, 3).join(", ")}` : undefined,
          image,
          specs,
          availability: STOCK_STATUS_MAP[p.stockStatus],
          price: p.price,
          href: `/products/${p.slug}`,
        };
      })
      .filter((p): p is ProductShowcaseItem => p !== null);
  } catch {
    // DB unreachable — render the page with fallback marketing figures and no live catalogue data.
  }

  return (
    <>
      {/* Cancels the (public) layout's fixed-nav offset so the hero bleeds to
          the true top of the viewport, with the nav floating transparently over it. */}
      <div className="-mt-[80px] md:-mt-[108px]">
        <CinematicHero skuCount={skuCount} />
      </div>
      <ManufacturingIntro />
      <ProductionMetrics skuCount={skuCount} dealerCount={dealerCount} stateCount={stateCount} />
      <ManufacturingProcess />
      <ProductCategories categories={categories} />
      <ProductSpotlight products={showcaseProducts} />
      <QualitySection />
      <DealerNetworkSection dealerCount={dealerCount} stateCount={stateCount} />
      <PlatformJourney />
      <OrderLifecycleSection />
      <MadeInIndia />
      <ExpansionRoadmap />
      <FinalCta />
    </>
  );
}
