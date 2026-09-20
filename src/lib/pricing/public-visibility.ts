import type { Session } from "next-auth";

/**
 * Wholesale pricing (Product.price / ProductVariant.price) is a B2B dealer
 * rate — it must never reach a guest or non-dealer viewer, on any surface:
 * the public catalog/detail pages, their underlying /api/products routes,
 * SEO metadata, or JSON-LD. Hiding it in the UI isn't enough (it's still
 * inspectable in the network response) — the field itself must be absent
 * from what actually leaves the server.
 */
export function isDealerViewer(session: Session | null): boolean {
  return session?.user?.role === "DEALER";
}

/**
 * Broader than isDealerViewer: also true for admin/staff, who legitimately
 * need Product.price through /api/products and /api/products/[id] for their
 * own tooling (bulk edit, vehicle-diagram product assignment, consolidation)
 * — those routes are shared between the public storefront and authenticated
 * admin UI. The public storefront pages use the stricter isDealerViewer
 * instead, since "Login as Dealer" messaging there wouldn't make sense for
 * an admin.
 */
export function canSeeWholesalePrice(session: Session | null): boolean {
  const role = session?.user?.role;
  return !!role && ["DEALER", "ADMIN", "SUPER_ADMIN", "STAFF"].includes(role);
}

/**
 * Strips `price` from a product (and each of its variants) for a non-dealer
 * viewer. Call this on every product object before it crosses a server/client
 * boundary (a Server Component passing props to a Client Component) or before
 * an API route serializes its response — never just at render time, since by
 * then the field has already left the server.
 */
export function stripWholesalePrice<T extends Record<string, any>>(product: T, isDealer: boolean): T {
  if (isDealer) return product;
  const { price, vendorCostPrice, markupPercent, ...rest } = product;
  const stripped: Record<string, any> = { ...rest };
  if (Array.isArray(product.variants)) {
    stripped.variants = product.variants.map((variant: Record<string, any>) => {
      const { price: _variantPrice, ...variantRest } = variant;
      return variantRest;
    });
  }
  return stripped as T;
}

export function stripWholesalePriceFromList<T extends Record<string, any>>(products: T[], isDealer: boolean): T[] {
  return products.map((p) => stripWholesalePrice(p, isDealer));
}
