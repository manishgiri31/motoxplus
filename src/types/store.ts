/** Smallest currency unit (paise/cents). Never a float. */
export type Money = number;

export interface StoreProduct {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  category: string;
  price: Money;
  currency: "INR" | "USD" | "EUR" | "GBP";
  badge?: "New" | "Sale" | "Limited";
  images: string[];
  featured?: boolean;
  inStock: boolean;
}
