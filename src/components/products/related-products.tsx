import Link from "next/link";
import Image from "next/image";
import { getCompatibleProductIds, type CompatibilityFilter } from "@/lib/vehicle/compatibility";
import { getRelatedByCompatibleIds, getRelatedByCategory } from "@/lib/catalog/queries";

interface ProductImage { imageUrl: string; isPrimary: boolean; }
interface RelatedProduct {
  id: string;
  slug: string;
  name: string;
  partNumber: string;
  images: string[];
  productImages?: ProductImage[];
}

interface VehicleContext { slug: string; name: string; }

interface Props {
  productId: string;
  categoryId: string;
  categoryName: string;
  vehicleContext: VehicleContext | null;
  vehicleFilter: CompatibilityFilter | null;
}

function getRelatedThumb(p: RelatedProduct) {
  return p.productImages && p.productImages.length > 0
    ? p.productImages.find((i) => i.isPrimary)?.imageUrl || p.productImages[0]?.imageUrl
    : p.images[0];
}

/** Server component streamed into ProductDetailClient's children via
 *  <Suspense> — runs the (cached, but potentially cold) related-products
 *  query independently of the main product paint. See
 *  src/app/(public)/products/[slug]/page.tsx. */
export async function RelatedProducts({ productId, categoryId, categoryName, vehicleContext, vehicleFilter }: Props) {
  let relatedProducts: RelatedProduct[] = [];

  if (vehicleFilter) {
    const compatibleIds = (await getCompatibleProductIds(vehicleFilter)).filter((id) => id !== productId);
    if (compatibleIds.length > 0) {
      relatedProducts = await getRelatedByCompatibleIds(compatibleIds);
    }
  }

  if (relatedProducts.length === 0) {
    relatedProducts = await getRelatedByCategory(categoryId, productId);
  }

  if (relatedProducts.length === 0) return null;

  return (
    <div>
      <div className="flex items-end justify-between mb-8 gap-4 flex-wrap">
        <h2 className="font-display text-2xl font-bold text-[var(--ink)]">
          {vehicleContext ? (
            <>More parts for <span className="text-[var(--red)]">{vehicleContext.name}</span></>
          ) : (
            <>More from <span className="text-[var(--red)]">{categoryName}</span></>
          )}
        </h2>
        {vehicleContext && (
          <Link
            href={`/products?vehicle=${vehicleContext.slug}`}
            className="text-[var(--red)] hover:text-[var(--red-hover)] text-xs font-bold uppercase tracking-wider transition-colors"
          >
            View all →
          </Link>
        )}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-[var(--line)] border border-[var(--line)]">
        {relatedProducts.map((p) => {
          const thumb = getRelatedThumb(p);
          return (
            <Link
              key={p.id}
              href={`/products/${p.slug}${vehicleContext ? `?vehicle=${vehicleContext.slug}` : ""}`}
              className="group bg-[var(--card)] hover:bg-[var(--paper)] transition-colors block"
            >
              <div className="relative h-36 bg-[var(--paper)] border-b border-[var(--line)]">
                {thumb ? (
                  <Image src={thumb} alt={p.name} fill className="object-cover" sizes="300px" unoptimized />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="text-4xl text-[var(--line)] font-black">◈</div>
                  </div>
                )}
              </div>
              <div className="p-4">
                <div className="text-[var(--muted)] text-[10px] font-mono mb-1">{p.partNumber}</div>
                <h4 className="text-[var(--ink)] text-sm font-bold line-clamp-2 group-hover:text-[var(--red)] transition-colors">
                  {p.name}
                </h4>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function RelatedProductsSkeleton() {
  return (
    <div>
      <div className="skeleton h-7 w-56 rounded mb-8" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-[var(--line)] border border-[var(--line)]">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-[var(--card)]">
            <div className="skeleton h-36 w-full rounded-none" />
            <div className="p-4 space-y-2">
              <div className="skeleton h-3 w-1/3 rounded" />
              <div className="skeleton h-4 w-4/5 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
