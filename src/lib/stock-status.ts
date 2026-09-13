import type { ProductStockStatus } from "@prisma/client";

// Numeric variant of stock status — ProductVariant.stock is still a real
// counted quantity (unlike Product.stockStatus, which is an admin-set enum),
// so variant availability is still derived from a number.
export const LOW_STOCK_THRESHOLD = 5;

export type StockStatus = "in_stock" | "low_stock" | "out_of_stock";

export function getStockStatus(stock: number): StockStatus {
  if (stock <= 0) return "out_of_stock";
  if (stock <= LOW_STOCK_THRESHOLD) return "low_stock";
  return "in_stock";
}

export function stockStatusLabel(stock: number): string {
  const status = getStockStatus(stock);
  if (status === "out_of_stock") return "Out of Stock";
  if (status === "low_stock") return `Only ${stock} left`;
  return "In Stock";
}

// Product.stockStatus variant — Product no longer tracks a countable
// quantity; it's a manually-set three-state enum.
export const PRODUCT_STOCK_STATUS_OPTIONS: { value: ProductStockStatus; label: string }[] = [
  { value: "IN_STOCK", label: "In Stock" },
  { value: "FEW_LEFT", label: "Few Left" },
  { value: "OUT_OF_STOCK", label: "Out of Stock" },
];

export function productStockLabel(status: ProductStockStatus): string {
  if (status === "OUT_OF_STOCK") return "Out of Stock";
  if (status === "FEW_LEFT") return "Few Left";
  return "In Stock";
}

export function productStockBadgeClass(status: ProductStockStatus): string {
  if (status === "OUT_OF_STOCK") return "bg-red-500/15 text-red-500";
  if (status === "FEW_LEFT") return "bg-amber-500/15 text-amber-500";
  return "bg-green-500/15 text-green-600";
}
