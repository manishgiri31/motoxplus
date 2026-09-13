-- CreateEnum
CREATE TYPE "ProductStockStatus" AS ENUM ('IN_STOCK', 'FEW_LEFT', 'OUT_OF_STOCK');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "stockStatus" "ProductStockStatus" NOT NULL DEFAULT 'IN_STOCK';
ALTER TABLE "Product" ALTER COLUMN "stock" DROP NOT NULL;

-- Backfill stockStatus from the existing numeric stock (stock is deprecated but
-- still present so old rows classify correctly instead of all landing on the
-- column default): >10 -> IN_STOCK, 1-10 -> FEW_LEFT, 0 -> OUT_OF_STOCK.
UPDATE "Product" SET "stockStatus" = CASE
  WHEN "stock" > 10 THEN 'IN_STOCK'::"ProductStockStatus"
  WHEN "stock" >= 1 THEN 'FEW_LEFT'::"ProductStockStatus"
  ELSE 'OUT_OF_STOCK'::"ProductStockStatus"
END;

-- DropIndex
DROP INDEX "Product_stock_idx";

-- CreateIndex
CREATE INDEX "Product_stockStatus_idx" ON "Product"("stockStatus");
