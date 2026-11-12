-- CreateEnum
CREATE TYPE "WarehouseOwnerType" AS ENUM ('MOTOXPLUS', 'VENDOR');

-- CreateEnum
CREATE TYPE "WarehouseStatus" AS ENUM ('PENDING', 'ACTIVE', 'FAILED');

-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('B2B', 'B2C');

-- CreateEnum
CREATE TYPE "GstinVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'INVALID', 'INACTIVE');

-- AlterEnum
ALTER TYPE "VendorDocumentType" ADD VALUE 'ADDRESS_PROOF';

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "deliveryAddress" TEXT,
ADD COLUMN     "deliveryCity" TEXT,
ADD COLUMN     "deliveryPincode" TEXT,
ADD COLUMN     "deliveryState" TEXT;

-- AlterTable
ALTER TABLE "Dealer" ADD COLUMN     "gstCheckAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "gstLastCheckedAt" TIMESTAMP(3),
ADD COLUMN     "gstLegalName" TEXT,
ADD COLUMN     "gstPrincipalAddress" TEXT,
ADD COLUMN     "gstRegistrationStatus" TEXT,
ADD COLUMN     "gstTradeName" TEXT,
ADD COLUMN     "gstVerificationSource" TEXT,
ADD COLUMN     "gstVerificationStatus" "GstinVerificationStatus";

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "buyerGstin" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "pickupLocationName" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "customerType" "CustomerType";

-- CreateTable
CREATE TABLE "DelhiveryWarehouse" (
    "id" TEXT NOT NULL,
    "ownerType" "WarehouseOwnerType" NOT NULL,
    "vendorId" TEXT,
    "delhiveryName" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "pin" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "returnAddress" TEXT NOT NULL,
    "returnPin" TEXT NOT NULL,
    "returnCity" TEXT NOT NULL,
    "returnState" TEXT NOT NULL,
    "gstin" TEXT,
    "status" "WarehouseStatus" NOT NULL DEFAULT 'PENDING',
    "lastError" TEXT,
    "lastErrorCode" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "attemptStartedAt" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DelhiveryWarehouse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DelhiveryWarehouse_vendorId_key" ON "DelhiveryWarehouse"("vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "DelhiveryWarehouse_delhiveryName_key" ON "DelhiveryWarehouse"("delhiveryName");

-- CreateIndex
CREATE INDEX "DelhiveryWarehouse_status_idx" ON "DelhiveryWarehouse"("status");

-- CreateIndex
CREATE INDEX "Order_pickupLocationName_idx" ON "Order"("pickupLocationName");

-- CreateIndex
CREATE INDEX "User_customerType_idx" ON "User"("customerType");

-- AddForeignKey
ALTER TABLE "DelhiveryWarehouse" ADD CONSTRAINT "DelhiveryWarehouse_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;