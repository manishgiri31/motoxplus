-- CreateEnum
CREATE TYPE "CancelReasonCode" AS ENUM ('CHANGED_MIND', 'ORDERED_BY_MISTAKE', 'FOUND_BETTER_PRICE', 'DELIVERY_TOO_SLOW', 'OTHER');

-- CreateEnum
CREATE TYPE "CancelActor" AS ENUM ('DEALER', 'ADMIN', 'SYSTEM');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('NOT_APPLICABLE', 'INITIATED', 'PROCESSED', 'FAILED');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "stockReserved" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "OrderCancellation" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "fromStatus" "OrderStatus" NOT NULL,
    "feePercent" DOUBLE PRECISION NOT NULL,
    "feeAmount" DOUBLE PRECISION NOT NULL,
    "amountPaidAtCancellation" DOUBLE PRECISION NOT NULL,
    "refundAmount" DOUBLE PRECISION NOT NULL,
    "reasonCode" "CancelReasonCode" NOT NULL,
    "reason" VARCHAR(500),
    "cancelledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledByUserId" TEXT NOT NULL,
    "cancelledByRole" "CancelActor" NOT NULL,
    "refundStatus" "RefundStatus" NOT NULL DEFAULT 'NOT_APPLICABLE',
    "refundId" TEXT,
    "refundedAt" TIMESTAMP(3),
    "refundError" TEXT,

    CONSTRAINT "OrderCancellation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderEvent" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fromStatus" "OrderStatus",
    "toStatus" "OrderStatus",
    "actorId" TEXT,
    "actorRole" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrderCancellation_orderId_key" ON "OrderCancellation"("orderId");

-- CreateIndex
CREATE INDEX "OrderCancellation_refundStatus_idx" ON "OrderCancellation"("refundStatus");

-- CreateIndex
CREATE INDEX "OrderEvent_orderId_createdAt_idx" ON "OrderEvent"("orderId", "createdAt");

-- AddForeignKey
ALTER TABLE "OrderCancellation" ADD CONSTRAINT "OrderCancellation_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderEvent" ADD CONSTRAINT "OrderEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

