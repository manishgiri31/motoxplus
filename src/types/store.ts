/** Smallest currency unit (paise/cents). Never a float. */
export type Money = number;

export interface StoreProduct {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  category: string;
  /** Omitted until real pricing is wired in; cards then show a "Shop" link instead of a price. */
  price?: Money;
  currency: "INR" | "USD" | "EUR" | "GBP";
  badge?: "New" | "Sale" | "Limited";
  /** R2 object keys (e.g. "products/<uuid>.webp") or absolute URLs. */
  images: string[];
  featured?: boolean;
  inStock: boolean;
}
