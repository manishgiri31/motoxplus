import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ProductCatalog } from "@/components/products/product-catalog";
import { getCatalogList } from "@/lib/catalog/queries";
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
  const search = searchParams.search?.trim();
  // Session is used ONLY for this page's header copy below — never for the
  // catalog data itself. Product rows (price + mrp) are identical for every
  // viewer regardless of role (see lib/pricing/channel.ts displayChannel()),
  // so getCatalogList() below is safe to cache without a role in its key;
  // this isCustomer check stays outside that cache and re-evaluates fresh
  // on every request.
  const session = await getServerSession(authOptions);
  const isCustomer = session?.user?.role === "CUSTOMER";

  const { products, categories, totalProducts, vehicleName, pageSize } = await getCatalogList({
    category: searchParams.category,
    search,
    page,
    vehicle: searchParams.vehicle,
    variant: searchParams.variant,
    section: searchParams.section,
  });

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
            ) : isCustomer ? (
              <>{totalProducts}+ products across all categories. Prices shown are MRP, inclusive of all taxes.</>
            ) : (
              <>{totalProducts}+ products across all categories. Dealer prices and MRP shown below — sign in as a dealer to place orders.</>
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
