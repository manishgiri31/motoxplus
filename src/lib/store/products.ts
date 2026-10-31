import data from "@/data/store-products.json";
import type { StoreProduct } from "@/types/store";

// Public R2 bucket (same origin whitelisted in next.config.mjs images + CSP). Hardcoded default
// because .env.local carries a placeholder R2_PUBLIC_URL in dev.
const R2_PUBLIC = (process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "https://pub-966fa80d99d64e388b250232523a507f.r2.dev").replace(/\/$/, "");

/** R2 key or absolute URL -> absolute image URL. */
export const imageUrl = (src: string) => (/^https?:\/\//.test(src) ? src : `${R2_PUBLIC}/${src.replace(/^\//, "")}`);

/** Hero photograph (R2). */
export const HERO_IMAGE = "products/20026819-600d-4fea-84b6-2536b98a795c.webp";

// All reads go through here so the JSON file can later be swapped for the
// catalogue DB without touching components.
const products = data as StoreProduct[];

export const getProducts = (): StoreProduct[] => products;
export const getFeaturedProducts = (): StoreProduct[] => products.filter((p) => p.featured);

/** Curated slugs aren't DB product slugs, so link into the existing catalogue search instead of a product page. */
export const productHref = (p: StoreProduct) => `/products?search=${encodeURIComponent(p.name)}`;
