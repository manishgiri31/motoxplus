import { prisma } from "@/lib/prisma";
import { BROWSABLE_CATEGORY_WHERE, productCategorySlugWhere } from "@/lib/catalog/storefront-categories";
import { parsePageParam, clampSearch } from "@/lib/query-limits";
import { DealerProductCatalog } from "@/components/dealer/dealer-product-catalog";
import { buildSearchWhere } from "@/lib/product-search";

export default async function DealerProductsPage(
  props: {
    searchParams: Promise<{ category?: string; search?: string; page?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const page = parsePageParam(searchParams.page);
  const pageSize = 12;
  const search = clampSearch(searchParams.search); // bounded: it is also the cache key

  const searchWhere = search ? await buildSearchWhere(search, true) : {};

  const where = {
    isActive: true,
    ...(searchParams.category ? productCategorySlugWhere(searchParams.category) : {}),
    ...searchWhere,
  };

  const [products, categories, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: {
        category: true,
        productImages: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }], take: 1 },
        _count: { select: { variants: { where: { isActive: true } } } },
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
      // Enum declaration order (MOTOXPLUS, EAUTO_IMPORT, VENDOR) is what makes
      // `asc` here put our own catalog first — see (public)/products/page.tsx.
      orderBy: [{ source: "asc" }, { createdAt: "desc" }],
    }),
    prisma.category.findMany({ where: BROWSABLE_CATEGORY_WHERE, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.product.count({ where }),
  ]);

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-black text-[var(--text-primary)] tracking-tight">Products</h1>
        <p className="text-[var(--text-muted)] text-sm mt-0.5">Browse and order from our complete catalog</p>
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
