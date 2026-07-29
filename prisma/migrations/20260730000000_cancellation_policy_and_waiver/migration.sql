-- AlterTable
ALTER TABLE "OrderCancellation" ADD COLUMN     "waived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "waivedByUserId" TEXT,
ADD COLUMN     "waivedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "CancellationPolicy" (
    "id" TEXT NOT NULL,
    "preShipChargePercent" DOUBLE PRECISION NOT NULL DEFAULT 2.0,
    "postShipChargePercent" DOUBLE PRECISION NOT NULL DEFAULT 20.0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "CancellationPolicy_pkey" PRIMARY KEY ("id")
);
