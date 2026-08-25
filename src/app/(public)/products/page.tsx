import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { ProductCatalog } from "@/components/products/product-catalog";
import { buildSearchWhere } from "@/lib/product-search";
import { getCompatibleProductIds, type CompatibilityFilter } from "@/lib/vehicle/compatibility";
import { Eyebrow } from "@/components/ui/technical";

export const metadata: Metadata = {
  title: "Products",
  description: "Browse MotoXPlus India's complete range of two-wheeler spare parts.",
};

export default async function ProductsPage(
  props: {
    searchParams: Promise<{ category?: string; search?: string; page?: string; vehicle?: string; variant?: string; section?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const page = parseInt(searchParams.page || "1");
  const pageSize = 12;
  const search = searchParams.search?.trim();

  const searchWhere = search ? await buildSearchWhere(search, true) : {};

  let vehicleWhere = {};
  let vehicleName: string | undefined;
  if (searchParams.vehicle) {
    const vehicle = await prisma.vehicle.findUnique({ where: { slug: searchParams.vehicle } });
    if (vehicle) {
      vehicleName = vehicle.name;
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
      const productIds = await getCompatibleProductIds(filter);
      vehicleWhere = { id: { in: productIds } };
    }
  }

  const baseWhere = {
    isActive: true,
    ...(searchParams.category && { category: { slug: searchParams.category } }),
    ...searchWhere,
    ...vehicleWhere,
  };

  const [products, categories, totalProducts] = await Promise.all([
    (prisma.product as any).findMany({
      where: baseWhere,
      include: {
        category: true,
        productImages: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }], take: 1 },
        variants: {
          where: { isActive: true, color: { not: null } },
          select: { color: true },
          take: 6,
        },
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: [{ stock: "desc" }, { createdAt: "desc" }],
    }),
    prisma.category.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.product.count({ where: baseWhere }),
  ]);

  return (
    <div className="min-h-screen bg-[var(--paper)]">
      {/* Header */}
      <section className="py-14 px-4 md:px-8 border-b border-[var(--line)]">
        <div className="max-w-7xl mx-auto">
          <Eyebrow className="mb-4">Product Catalog</Eyebrow>
          <h1 className="font-display text-3xl md:text-4xl font-bold text-[var(--ink)] tracking-tight">
            Premium spare parts.
          </h1>
          <p className="text-[var(--muted)] mt-3 max-w-xl">
            {vehicleName ? (
              <>Showing {totalProducts} part{totalProducts === 1 ? "" : "s"} compatible with <span className="text-[var(--ink)] font-semibold">{vehicleName}</span>.</>
            ) : (
              <>{totalProducts}+ products across all categories. Wholesale prices and MRP shown below — dealer login required to place orders.</>
            )}
          </p>
        </div>
      </section>

      <ProductCatalog
        products={JSON.parse(JSON.stringify(products))}
        categories={JSON.parse(JSON.stringify(categories))}
        totalProducts={totalProducts}
        currentPage={page}
        pageSize={pageSize}
        currentCategory={searchParams.category}
        currentSearch={search}
        currentVehicle={searchParams.vehicle}
        currentVariant={searchParams.variant}
        currentSection={searchParams.section}
      />
    </div>
  );
}
