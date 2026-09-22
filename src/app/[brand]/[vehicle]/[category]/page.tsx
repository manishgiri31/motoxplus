import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getBrandVehicleCategoryData } from "@/lib/catalog/queries";
import { JsonLd } from "@/components/seo/json-ld";
import { absoluteUrl, buildMetadata } from "@/lib/seo";
import { ChevronRight } from "lucide-react";

interface Params {
  brand: string;
  vehicle: string;
  category: string;
}

// Data fetch itself lives in lib/catalog/queries.ts, cached — it's a pure
// DB read (price + mrp are the same for every viewer, see
// lib/pricing/channel.ts). The isCustomer branch below runs after this
// resolves, fresh on every request, never inside the cache.
const resolve = getBrandVehicleCategoryData;

export async function generateMetadata(props: { params: Promise<Params> }): Promise<Metadata> {
  const params = await props.params;
  const data = await resolve(params);
  if (!data) return { title: "Not Found" };
  const { manufacturer, vehicle, category, products } = data;

  const title = `${vehicle.name} ${category.name} | ${manufacturer.name} Spare Parts`;
  const description = `Shop OEM-compatible ${category.name.toLowerCase()} for the ${manufacturer.name} ${vehicle.name}. ${products.length} verified-fit part${products.length === 1 ? "" : "s"} from MOTOXPLUS, tested for durability and precision fitment.`;

  return buildMetadata({
    title,
    description,
    path: `/${params.brand}/${params.vehicle}/${params.category}`,
    image: products[0]?.productImages?.[0]?.imageUrl,
  });
}

export default async function BrandVehicleCategoryPage(props: { params: Promise<Params> }) {
  const params = await props.params;
  const data = await resolve(params);
  if (!data) notFound();
  const { manufacturer, vehicle, category, products, vehicleCategory } = data;
  const pageUrl = absoluteUrl(`/${params.brand}/${params.vehicle}/${params.category}`);
  const session = await getServerSession(authOptions);
  const isCustomer = session?.user?.role === "CUSTOMER";

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
            { "@type": "ListItem", position: 2, name: manufacturer.name, item: absoluteUrl(`/vehicles`) },
            {
              "@type": "ListItem",
              position: 3,
              name: vehicle.name,
              item: vehicleCategory ? absoluteUrl(`/vehicles/${vehicleCategory.slug}/${vehicle.slug}`) : absoluteUrl("/vehicles"),
            },
            { "@type": "ListItem", position: 4, name: category.name, item: pageUrl },
          ],
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: `${vehicle.name} ${category.name}`,
          url: pageUrl,
          about: { "@type": "Product", name: `${vehicle.name} ${category.name}` },
          hasPart: products.slice(0, 20).map((p) => ({
            "@type": "Product",
            name: p.name,
            sku: p.sku,
            url: absoluteUrl(`/products/${p.slug}`),
          })),
        }}
      />

      {/* Breadcrumb + header */}
      <section className="py-16 px-4 md:px-8 border-b border-[var(--border-color)]">
        <div className="max-w-7xl mx-auto">
          <nav aria-label="Breadcrumb" className="flex items-center flex-wrap gap-1.5 text-xs uppercase tracking-widest font-semibold mb-6">
            <Link href="/" className="text-[var(--text-muted)] hover:text-red-500 transition-colors">Home</Link>
            <ChevronRight size={12} className="text-[var(--text-muted)]/50" />
            {vehicleCategory && (
              <>
                <Link href={`/vehicles/${vehicleCategory.slug}/${vehicle.slug}`} className="text-[var(--text-muted)] hover:text-red-500 transition-colors">
                  {vehicle.name}
                </Link>
                <ChevronRight size={12} className="text-[var(--text-muted)]/50" />
              </>
            )}
            <span className="text-red-500">{category.name}</span>
          </nav>
          <h1 className="text-4xl md:text-5xl font-black text-[var(--text-primary)] tracking-tight mb-4">
            {vehicle.name} <span className="text-gradient-red">{category.name}.</span>
          </h1>
          <p className="text-[var(--text-muted)] max-w-2xl leading-relaxed">
            Browse {products.length} OEM-compatible {category.name.toLowerCase()} option{products.length === 1 ? "" : "s"} for the{" "}
            {manufacturer.name} {vehicle.name}. Every part is manufactured to original equipment
            specifications and tested before it ships to our dealer network.
          </p>
        </div>
      </section>

      {/* Product grid */}
      <section className="py-12 px-4 md:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {products.map((p) => {
              const thumb = p.productImages[0]?.imageUrl || p.images[0];
              return (
                <Link
                  key={p.id}
                  href={`/products/${p.slug}`}
                  className="group glass border border-[var(--border-color)] hover:border-red-900/40 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 block"
                >
                  <div className="relative h-44 bg-[var(--bg-secondary)] flex items-center justify-center overflow-hidden">
                    {thumb ? (
                      <Image src={thumb} alt={`${vehicle.name} ${p.name}`} fill className="object-cover group-hover:scale-105 transition-transform duration-500" sizes="280px" unoptimized />
                    ) : (
                      <div className="text-5xl text-red-500/20 font-black">◈</div>
                    )}
                  </div>
                  <div className="p-4">
                    <div className="text-[var(--text-muted)] text-[10px] uppercase tracking-widest mb-1 font-mono opacity-70">{p.partNumber}</div>
                    <h3 className="text-[var(--text-primary)] font-bold text-sm mb-2 line-clamp-2 group-hover:text-red-600 transition-colors">{p.name}</h3>
                    <div className="pt-3 border-t border-[var(--border-color)]">
                      {isCustomer ? (
                        <>
                          <div className="text-[var(--text-muted)] text-[9px] uppercase tracking-widest font-bold mb-0.5">MRP</div>
                          {p.mrp ? (
                            <span className="text-red-500 font-black text-base">₹{p.mrp.toLocaleString("en-IN")}</span>
                          ) : (
                            <span className="text-[var(--text-muted)] text-xs">Not available for retail</span>
                          )}
                        </>
                      ) : (
                        <>
                          <div className="text-[var(--text-muted)] text-[9px] uppercase tracking-widest font-bold mb-0.5">Dealer Price</div>
                          <div className="flex items-end justify-between gap-2">
                            <span className="text-red-500 font-black text-base">₹{p.price.toLocaleString("en-IN")}</span>
                            {p.mrp && p.mrp > p.price && (
                              <span className="text-[var(--text-muted)] text-[10px] line-through">MRP ₹{p.mrp.toLocaleString("en-IN")}</span>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {vehicleCategory && (
            <div className="mt-10 text-center">
              <Link
                href={`/vehicles/${vehicleCategory.slug}/${vehicle.slug}`}
                className="text-red-500 hover:text-red-600 font-semibold text-sm uppercase tracking-wider transition-colors"
              >
                View full {vehicle.name} specs & compatible parts →
              </Link>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
