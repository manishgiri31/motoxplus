-- AlterTable: Product.price becomes a whole-rupee integer.
-- Charm-pricing convention tightened from "any odd whole rupee"
-- (fix-odd-prices.ts / seed-cables.ts) to "last digit is 3, 6, 7, or 9" —
-- snap every existing price to the nearest allowed value (ties broken
-- upward) before narrowing the column type, so no value is truncated.
-- Digit -> delta table mirrors src/lib/pricing/charm-price.ts.
UPDATE "Product" SET price = ROUND(price)::int + CASE ROUND(price)::int % 10
  WHEN 0 THEN -1
  WHEN 1 THEN 2
  WHEN 2 THEN 1
  WHEN 3 THEN 0
  WHEN 4 THEN -1
  WHEN 5 THEN 1
  WHEN 6 THEN 0
  WHEN 7 THEN 0
  WHEN 8 THEN 1
  WHEN 9 THEN 0
END;

ALTER TABLE "Product" ALTER COLUMN "price" TYPE INTEGER USING ROUND(price)::integer;

-- Same convention for ProductVariant.price — a variant is itself a
-- purchasable line item with its own price, so it must satisfy the same
-- invariant as Product.price.
UPDATE "ProductVariant" SET price = ROUND(price)::int + CASE ROUND(price)::int % 10
  WHEN 0 THEN -1
  WHEN 1 THEN 2
  WHEN 2 THEN 1
  WHEN 3 THEN 0
  WHEN 4 THEN -1
  WHEN 5 THEN 1
  WHEN 6 THEN 0
  WHEN 7 THEN 0
  WHEN 8 THEN 1
  WHEN 9 THEN 0
END;

ALTER TABLE "ProductVariant" ALTER COLUMN "price" TYPE INTEGER USING ROUND(price)::integer;
