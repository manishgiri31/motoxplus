import { prisma } from "@/lib/prisma";
import { DealerProductCatalog } from "@/components/dealer/dealer-product-catalog";
import { buildSearchWhere } from "@/lib/product-search";

export default async function DealerProductsPage({
  searchParams,
}: {
  searchParams: { category?: string; search?: string; page?: string };
}) {
  const page = parseInt(searchParams.page || "1");
  const pageSize = 12;
  const search = searchParams.search?.trim();

  const searchWhere = search ? await buildSearchWhere(search, true) : {};

  const where = {
    isActive: true,
    ...(searchParams.category ? { category: { slug: searchParams.category } } : {}),
    ...searchWhere,
  };

  const [products, categories, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: {
        category: true,
        productImages: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }], take: 1 },
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: "desc" },
    }),
    prisma.category.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    prisma.product.count({ where }),
  ]);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight">Products</h1>
        <p className="text-[var(--text-muted)] mt-1">Browse and order from our complete catalog</p>
      </div>
      <DealerProductCatalog
        products={JSON.parse(JSON.stringify(products))}
        categories={JSON.parse(JSON.stringify(categories))}
        total={total}
        currentPage={page}
        pageSize={pageSize}
        currentCategory={searchParams.category}
        currentSearch={search}
      />
    </div>
  );
}
