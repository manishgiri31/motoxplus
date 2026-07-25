import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ProductDetailClient } from "@/components/products/product-detail-client";
import { JsonLd } from "@/components/seo/json-ld";
import { absoluteUrl, buildMetadata, truncate, SITE_NAME_SHORT } from "@/lib/seo";
import { getCompatibleProductIds, type CompatibilityFilter } from "@/lib/vehicle/compatibility";

type SearchParams = { vehicle?: string; variant?: string; section?: string };

function redirectQueryString(searchParams: SearchParams): string {
  const qs = new URLSearchParams();
  if (searchParams.vehicle) qs.set("vehicle", searchParams.vehicle);
  if (searchParams.variant) qs.set("variant", searchParams.variant);
  if (searchParams.section) qs.set("section", searchParams.section);
  const s = qs.toString();
  return s ? `?${s}` : "";
}

// A single [slug] segment serves both the canonical `/products/<slug>` URL and
// any legacy `/products/<cuid>` link still pointing at the old id-based route —
// old links redirect (308) to the canonical slug URL instead of 404ing.
async function resolveBySlugOrLegacyId(value: string) {
  const bySlug = await (prisma.product as any).findUnique({
    where: { slug: value, isActive: true },
    include: {
      category: true,
      productImages: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] },
      variants: {
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: { images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] } },
      },
    },
  });
  if (bySlug) return { product: bySlug, legacySlug: null as string | null };

  const byId = await prisma.product.findUnique({ where: { id: value }, select: { slug: true } });
  return { product: null, legacySlug: byId?.slug ?? null };
}

export async function generateMetadata(
  props: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const params = await props.params;
  const { product, legacySlug } = await resolveBySlugOrLegacyId(params.slug);
  const canonicalSlug = product?.slug ?? legacySlug;
  if (!canonicalSlug) return { title: "Product Not Found" };

  // Legacy id URL: metadata is irrelevant (the page redirects before rendering),
  // but resolve minimal fields so this branch never throws.
  const p = product ?? (await prisma.product.findUnique({ where: { slug: canonicalSlug }, include: { category: true } }));
  if (!p) return { title: "Product Not Found" };

  const titleSuffix = ` – Buy Online | ${SITE_NAME_SHORT}`;
  const title = `${truncate(p.name, 60 - titleSuffix.length)}${titleSuffix}`;
  const priceLine = `₹${p.price.toLocaleString("en-IN")}`;
  const description = truncate(
    p.description
      ? `${p.description} ${priceLine}. Part No. ${p.partNumber}.`
      : `${p.name} — OEM-compatible ${p.category.name.toLowerCase()} by ${p.brand}, manufactured in ${p.countryOfOrigin}. Part No. ${p.partNumber}. ${priceLine}.`,
    155
  );

  return buildMetadata({
    title,
    description,
    path: `/products/${p.slug}`,
    image: p.images[0],
  });
}

export default async function ProductDetailPage(
  props: {
    params: Promise<{ slug: string }>;
    searchParams: Promise<SearchParams>;
  }
) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const { product, legacySlug } = await resolveBySlugOrLegacyId(params.slug);

  if (!product) {
    if (legacySlug) permanentRedirect(`/products/${legacySlug}${redirectQueryString(searchParams)}`);
    notFound();
  }

  // If the visitor arrived filtered by a vehicle (e.g. from /products?vehicle=super-splendor),
  // show other parts compatible with that same vehicle instead of just same-category products —
  // this is what "all products available for that vehicle" refers to on the detail page.
  let vehicleContext: { slug: string; name: string } | null = null;
  let relatedProducts: any[] = [];

  if (searchParams.vehicle) {
    const vehicle = await prisma.vehicle.findUnique({ where: { slug: searchParams.vehicle } });
    if (vehicle) {
      vehicleContext = { slug: vehicle.slug, name: vehicle.name };
      const [selectedVariant, selectedSection] = await Promise.all([
        searchParams.variant
          ? prisma.vehicleVariant.findFirst({ where: { vehicleId: vehicle.id, slug: searchParams.variant } })
          : Promise.resolve(null),
        searchParams.section
          ? prisma.vehiclePartSection.findFirst({ where: { slug: searchParams.section } })
          : Promise.resolve(null),
      ]);
      const filter: CompatibilityFilter = {
        vehicleId: vehicle.id,
        variantId: selectedVariant?.id ?? null,
        generationId: selectedVariant?.generationId ?? null,
        sectionId: selectedSection?.id ?? null,
      };
      const compatibleIds = (await getCompatibleProductIds(filter)).filter((id) => id !== product.id);
      if (compatibleIds.length > 0) {
        relatedProducts = await (prisma.product as any).findMany({
          where: { id: { in: compatibleIds }, isActive: true },
          include: {
            category: true,
            productImages: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] },
          },
          take: 8,
          orderBy: [{ stock: "desc" }, { createdAt: "desc" }],
        });
      }
    }
  }

  if (relatedProducts.length === 0) {
    relatedProducts = await (prisma.product as any).findMany({
      where: {
        categoryId: product.categoryId,
        id: { not: product.id },
        isActive: true,
      },
      take: 4,
      include: {
        category: true,
        productImages: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] },
      },
    });
  }

  const productUrl = absoluteUrl(`/products/${product.slug}`);

  const reviewStats = await prisma.review.aggregate({
    where: { productId: product.id, isApproved: true },
    _avg: { rating: true },
    _count: { rating: true },
  });
  const aggregateRating =
    reviewStats._count.rating > 0 && reviewStats._avg.rating
      ? {
          "@type": "AggregateRating" as const,
          ratingValue: Number(reviewStats._avg.rating.toFixed(1)),
          reviewCount: reviewStats._count.rating,
        }
      : undefined;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
            { "@type": "ListItem", position: 2, name: "Products", item: absoluteUrl("/products") },
            {
              "@type": "ListItem",
              position: 3,
              name: product.category.name,
              item: absoluteUrl(`/products?category=${product.category.slug}`),
            },
            { "@type": "ListItem", position: 4, name: product.name, item: productUrl },
          ],
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Product",
          name: product.name,
          description: product.description || undefined,
          sku: product.sku,
          mpn: product.partNumber,
          image:
            product.productImages && product.productImages.length > 0
              ? product.productImages.map((img: { imageUrl: string }) => img.imageUrl)
              : product.images,
          brand: { "@type": "Brand", name: product.brand },
          manufacturer: { "@type": "Organization", name: product.brand },
          countryOfOrigin: product.countryOfOrigin,
          category: product.category.name,
          ...(aggregateRating ? { aggregateRating } : {}),
          offers: {
            "@type": "Offer",
            url: productUrl,
            priceCurrency: "INR",
            price: product.price,
            availability:
              product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
            itemCondition: "https://schema.org/NewCondition",
          },
        }}
      />

      {/* Breadcrumb */}
      <div className="border-b border-white/5 px-4 md:px-8 py-4">
        <div className="max-w-7xl mx-auto flex items-center gap-2 text-xs text-[var(--text-muted)]">
          <Link href="/" className="hover:text-red-400 transition-colors">Home</Link>
          <span>/</span>
          {vehicleContext ? (
            <>
              <Link href={`/products?vehicle=${vehicleContext.slug}`} className="hover:text-red-400 transition-colors">
                {vehicleContext.name}
              </Link>
              <span>/</span>
            </>
          ) : (
            <>
              <Link href="/products" className="hover:text-red-400 transition-colors">Products</Link>
              <span>/</span>
            </>
          )}
          <Link
            href={`/products?category=${product.category.slug}${vehicleContext ? `&vehicle=${vehicleContext.slug}` : ""}`}
            className="hover:text-red-400 transition-colors"
          >
            {product.category.name}
          </Link>
          <span>/</span>
          <span className="text-[var(--text-primary)]">{product.name}</span>
        </div>
      </div>

      <ProductDetailClient
        product={JSON.parse(JSON.stringify(product))}
        relatedProducts={JSON.parse(JSON.stringify(relatedProducts))}
        vehicleContext={vehicleContext}
      />
    </div>
  );
}
