-- CreateEnum
CREATE TYPE "SchemeRedemptionStatus" AS ENUM ('ACTIVE', 'ADJUSTED', 'CANCELLED');

-- AlterEnum
-- New value only — no existing OrderStatus row is touched, nothing in this
-- migration reads/writes the new value, so it's safe to add inside the same
-- transaction as everything else here (Postgres 12+: ALTER TYPE ... ADD
-- VALUE is transactional as long as the new value isn't used in that same
-- transaction, which it isn't).
ALTER TYPE "OrderStatus" ADD VALUE 'PARTIALLY_CANCELLED';

-- AlterTable
ALTER TABLE "Cart" ADD COLUMN     "schemeId" TEXT;

-- AlterTable
ALTER TABLE "CartItem" ADD COLUMN     "isSchemeItem" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "schemeBenefitValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "schemeAdjustmentAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "isSchemeItem" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "schemeDiscountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "dealerPriceAtOrder" DOUBLE PRECISION,
ADD COLUMN     "cancelledQuantity" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "OrderCancellation" ADD COLUMN     "schemeAdjustmentAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Scheme" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "benefitPercent" DOUBLE PRECISION NOT NULL DEFAULT 18,
    "minOrderValue" DOUBLE PRECISION NOT NULL,
    "maxBenefitValue" DOUBLE PRECISION,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Scheme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchemeRedemption" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "schemeId" TEXT NOT NULL,
    "benefitValue" DOUBLE PRECISION NOT NULL,
    "itemsValue" DOUBLE PRECISION NOT NULL,
    "status" "SchemeRedemptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SchemeRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItemCancellation" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "feeAmount" DOUBLE PRECISION NOT NULL,
    "schemeAdjustmentAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "refundAmount" DOUBLE PRECISION NOT NULL,
    "reasonCode" "CancelReasonCode" NOT NULL,
    "reason" VARCHAR(500),
    "cancelledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledByUserId" TEXT NOT NULL,
    "cancelledByRole" "CancelActor" NOT NULL,
    "refundStatus" "RefundStatus" NOT NULL DEFAULT 'NOT_APPLICABLE',
    "refundId" TEXT,

    CONSTRAINT "OrderItemCancellation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchemeCategory" (
    "schemeId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "SchemeCategory_pkey" PRIMARY KEY ("schemeId","categoryId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Scheme_code_key" ON "Scheme"("code");

-- CreateIndex
CREATE INDEX "Scheme_isActive_startsAt_endsAt_idx" ON "Scheme"("isActive", "startsAt", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "SchemeRedemption_orderId_key" ON "SchemeRedemption"("orderId");

-- CreateIndex
CREATE INDEX "SchemeRedemption_schemeId_idx" ON "SchemeRedemption"("schemeId");

-- CreateIndex
CREATE INDEX "OrderItemCancellation_orderId_idx" ON "OrderItemCancellation"("orderId");

-- CreateIndex
CREATE INDEX "OrderItemCancellation_orderItemId_idx" ON "OrderItemCancellation"("orderItemId");

-- CreateIndex
CREATE INDEX "SchemeCategory_categoryId_idx" ON "SchemeCategory"("categoryId");

-- AddForeignKey
ALTER TABLE "SchemeRedemption" ADD CONSTRAINT "SchemeRedemption_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchemeRedemption" ADD CONSTRAINT "SchemeRedemption_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "Scheme"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItemCancellation" ADD CONSTRAINT "OrderItemCancellation_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItemCancellation" ADD CONSTRAINT "OrderItemCancellation_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchemeCategory" ADD CONSTRAINT "SchemeCategory_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "Scheme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchemeCategory" ADD CONSTRAINT "SchemeCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
