import type { Session } from "next-auth";

/**
 * Showing Product.price (the dealer/wholesale rate) on the public storefront
 * is a deliberate business choice — it's the pitch that gets a visitor to
 * sign up as a dealer, alongside the struck-through MRP. What this guards
 * against instead is a script hitting GET /api/products or
 * /api/products/[id] directly and scraping the full structured catalog in
 * bulk with no barrier at all — materially easier than scraping rendered
 * HTML pages one at a time. Those two routes are only ever called by
 * authenticated admin tooling anyway (the storefront pages resolve their
 * own data via direct Prisma calls in a Server Component, not through this
 * API), so requiring this doesn't cost the storefront anything.
 */
export function canSeeWholesalePrice(session: Session | null): boolean {
  const role = session?.user?.role;
  return !!role && ["DEALER", "ADMIN", "SUPER_ADMIN", "STAFF"].includes(role);
}
