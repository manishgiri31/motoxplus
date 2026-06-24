import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { ProductCatalog } from "@/components/products/product-catalog";
import { buildSearchWhere } from "@/lib/product-search";

export const metadata: Metadata = {
  title: "Products",
  description: "Browse MotoXPlus India's complete range of two-wheeler spare parts.",
};

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: { category?: string; search?: string; page?: string };
}) {
  const page = parseInt(searchParams.page || "1");
  const pageSize = 12;
  const search = searchParams.search?.trim();

  const searchWhere = search ? await buildSearchWhere(search, true) : {};

  const baseWhere = {
    isActive: true,
    ...(searchParams.category && { category: { slug: searchParams.category } }),
    ...searchWhere,
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
      orderBy: { createdAt: "desc" },
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
            {totalProducts}+ products across all categories. Wholesale prices and MRP shown below — dealer login required to place orders.
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
