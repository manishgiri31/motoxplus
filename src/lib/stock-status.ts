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
