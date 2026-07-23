import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ProductDetailClient } from "@/components/products/product-detail-client";
import { JsonLd } from "@/components/seo/json-ld";
import { absoluteUrl, buildMetadata } from "@/lib/seo";
import { getCompatibleProductIds, type CompatibilityFilter } from "@/lib/vehicle/compatibility";

export async function generateMetadata(
  props: {
    params: Promise<{ id: string }>;
  }
): Promise<Metadata> {
  const params = await props.params;
  const product = await prisma.product.findUnique({
    where: { id: params.id },
    include: { category: true },
  });
  if (!product) return { title: "Product Not Found" };

  const title = `${product.name} | ${product.category.name}`;
  const description =
    product.description ||
    `${product.name} — OEM-compatible ${product.category.name.toLowerCase()} by ${product.brand}, manufactured in ${product.countryOfOrigin}. Part No. ${product.partNumber}.`;

  return buildMetadata({
    title,
    description,
    path: `/products/${product.id}`,
    image: product.images[0],
  });
}

export default async function ProductDetailPage(
  props: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ vehicle?: string; variant?: string; section?: string }>;
  }
) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const product = await (prisma.product as any).findUnique({
    where: { id: params.id, isActive: true },
    include: {
      category: true,
      productImages: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] },
      variants: {
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: {
          images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] },
        },
      },
    },
  });

  if (!product) notFound();

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

  const productUrl = absoluteUrl(`/products/${product.id}`);

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
          image: product.images,
          brand: { "@type": "Brand", name: product.brand },
          manufacturer: { "@type": "Organization", name: product.brand },
          countryOfOrigin: product.countryOfOrigin,
          category: product.category.name,
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
