import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { ProductCatalog } from "@/components/products/product-catalog";
import { buildSearchWhere } from "@/lib/product-search";
import { getCompatibleProductIds, type CompatibilityFilter } from "@/lib/vehicle/compatibility";

export const metadata: Metadata = {
  title: "Products",
  description: "Browse MotoXPlus India's complete range of two-wheeler spare parts.",
};

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: { category?: string; search?: string; page?: string; vehicle?: string; variant?: string; section?: string };
}) {
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
    prisma.product.findMany({
      where: baseWhere,
      include: {
        category: true,
        productImages: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }], take: 1 },
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
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Header */}
      <section className="py-16 px-4 md:px-8 border-b border-[var(--border-color)]">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-px bg-red-600" />
            <span className="text-red-500 text-xs font-semibold uppercase tracking-widest">Product Catalog</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-[var(--text-primary)] tracking-tight">
            Premium <span className="text-gradient-red">Spare Parts.</span>
          </h1>
          <p className="text-[var(--text-muted)] mt-4 max-w-xl">
            {vehicleName ? (
              <>Showing {totalProducts} part{totalProducts === 1 ? "" : "s"} compatible with <span className="text-[var(--text-primary)] font-semibold">{vehicleName}</span>.</>
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
      />
    </div>
  );
}
