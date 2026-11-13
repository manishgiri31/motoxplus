// Pure shipping-weight rules (no DB or network), so they can be tested without Prisma.
// Units: packageWeight / weight in kg; packageLength / packageWidth / packageHeight in cm.

/** Delhivery's volumetric divisor: volumetric kg = L × W × H (cm) ÷ 5000. */
export const VOLUMETRIC_DIVISOR = 5000;
/** Only used when a product has neither a weight nor a size. Backfill should leave no product here. */
export const DEFAULT_ITEM_WEIGHT_KG = 0.5;

export interface ShippingDimensionsInput {
  packageWeight?: number | null;
  weight?: number | null;
  packageLength?: number | null;
  packageWidth?: number | null;
  packageHeight?: number | null;
}

/**
 * Chargeable weight of ONE unit, as Delhivery bills it: the bigger of actual weight (kg) and
 * volumetric weight (L × W × H cm ÷ 5000). Size is only used when all three sides are set.
 */
export function itemChargeableWeightKg(product: ShippingDimensionsInput): number {
  const actual = product.packageWeight ?? product.weight ?? DEFAULT_ITEM_WEIGHT_KG;
  const { packageLength: l, packageWidth: w, packageHeight: h } = product;
  if (l && w && h) {
    const volumetric = (l * w * h) / VOLUMETRIC_DIVISOR;
    return Math.max(actual, volumetric);
  }
  return actual;
}

export function calculateOrderWeight(
  items: Array<{
    quantity: number;
    product: ShippingDimensionsInput;
  }>
): number {
  let total = 0;
  for (const item of items) {
    total += itemChargeableWeightKg(item.product) * item.quantity;
  }
  return Math.max(0.5, total);
}
