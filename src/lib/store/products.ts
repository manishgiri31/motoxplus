import data from "@/data/store-products.json";
import type { StoreProduct } from "@/types/store";

// All reads go through here so the JSON file can later be swapped for the
// catalogue DB without touching components.
const products = data as StoreProduct[];

export const getProducts = (): StoreProduct[] => products;
export const getFeaturedProducts = (): StoreProduct[] => products.filter((p) => p.featured);

/** Placeholder slugs aren't in the DB, so link into the existing catalogue search instead of a product page. */
export const productHref = (p: StoreProduct) => `/products?search=${encodeURIComponent(p.name)}`;
