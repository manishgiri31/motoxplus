-- CreateTable
CREATE TABLE "VehicleType" (
    "id" TEXT NOT NULL,
    "category" "VehicleCategory" NOT NULL,
    "heroImage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleType_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VehicleType_category_key" ON "VehicleType"("category");
