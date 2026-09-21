-- AlterEnum
-- New value only; nothing in this migration reads/writes it, so it's safe in
-- the same transaction (Postgres 12+). Precedent: 20260915000000's
-- PARTIALLY_CANCELLED addition to OrderStatus.
ALTER TYPE "UserRole" ADD VALUE 'CUSTOMER';

-- CreateTable
-- Thin B2C customer profile — name/phone/email live on User, same as Admin.
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Customer_userId_key" ON "Customer"("userId");

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: Cart
-- Now has two possible owners (B2B dealer / B2C customer). dealerId's unique
-- index survives DROP NOT NULL unchanged; Postgres treats NULL <> NULL in a
-- unique index, so multiple customer-owned rows (dealerId NULL) coexist fine,
-- same for multiple dealer-owned rows (customerId NULL).
ALTER TABLE "Cart" ALTER COLUMN "dealerId" DROP NOT NULL;
ALTER TABLE "Cart" ADD COLUMN "customerId" TEXT;
CREATE UNIQUE INDEX "Cart_customerId_key" ON "Cart"("customerId");
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- Every existing row has dealerId set and customerId NULL -> num_nonnulls = 1.
-- No backfill needed; the CHECK is satisfied by every current row as-is.
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_owner_exactly_one" CHECK (num_nonnulls("dealerId", "customerId") = 1);

-- AlterTable: Order
ALTER TABLE "Order" ALTER COLUMN "dealerId" DROP NOT NULL;
ALTER TABLE "Order" ADD COLUMN "customerId" TEXT;
CREATE INDEX "Order_customerId_createdAt_idx" ON "Order"("customerId", "createdAt");
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_owner_exactly_one" CHECK (num_nonnulls("dealerId", "customerId") = 1);

-- AlterTable: Invoice
ALTER TABLE "Invoice" ALTER COLUMN "dealerId" DROP NOT NULL;
ALTER TABLE "Invoice" ADD COLUMN "customerId" TEXT;
CREATE INDEX "Invoice_customerId_idx" ON "Invoice"("customerId");
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_owner_exactly_one" CHECK (num_nonnulls("dealerId", "customerId") = 1);

-- AlterTable: PaymentSubmission (B2C Direct UPI submissions)
ALTER TABLE "PaymentSubmission" ALTER COLUMN "dealerId" DROP NOT NULL;
ALTER TABLE "PaymentSubmission" ADD COLUMN "customerId" TEXT;
CREATE INDEX "PaymentSubmission_customerId_idx" ON "PaymentSubmission"("customerId");
ALTER TABLE "PaymentSubmission" ADD CONSTRAINT "PaymentSubmission_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentSubmission" ADD CONSTRAINT "PaymentSubmission_owner_exactly_one" CHECK (num_nonnulls("dealerId", "customerId") = 1);
