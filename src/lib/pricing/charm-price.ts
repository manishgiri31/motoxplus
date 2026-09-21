/**
 * Charm-pricing convention for Product.price: always a whole rupee whose
 * last digit is 3, 6, 7, or 9. Snaps to the nearest allowed value (ties
 * broken upward). Mirrors the digit-delta table duplicated in
 * prisma/fix-odd-prices.ts and prisma/seed-cables.ts, which can't import
 * from src/ since they run under plain ts-node.
 */
const LAST_DIGIT_DELTA = [-1, 2, 1, 0, -1, 1, 0, 0, 1, 0] as const;

export function roundToCharmPrice(value: number): number {
  const rounded = Math.round(value);
  return rounded + LAST_DIGIT_DELTA[((rounded % 10) + 10) % 10];
}
