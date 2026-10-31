-- CreateEnum
CREATE TYPE "PickupRequestStatus" AS ENUM ('PENDING', 'REQUESTED');

-- CreateTable
-- Additive: a new table, no existing rows or columns are touched.
CREATE TABLE "PickupRequest" (
    "id" TEXT NOT NULL,
    "channel" "OrderChannel" NOT NULL,
    "warehouse" TEXT NOT NULL,
    "pickupDate" TEXT NOT NULL,
    "pickupTime" TEXT NOT NULL,
    "status" "PickupRequestStatus" NOT NULL DEFAULT 'PENDING',
    "packageCount" INTEGER,
    "pickupId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PickupRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
-- One pickup per channel + warehouse + day; also the claim lock.
CREATE UNIQUE INDEX "PickupRequest_channel_warehouse_pickupDate_key" ON "PickupRequest"("channel", "warehouse", "pickupDate");
