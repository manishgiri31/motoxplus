-- AlterTable
-- Additive: three nullable timestamps, no existing column is touched.
ALTER TABLE "Order" ADD COLUMN     "confirmationSentAt" TIMESTAMP(3),
ADD COLUMN     "cancelNotifiedAt" TIMESTAMP(3),
ADD COLUMN     "shippedNotifiedAt" TIMESTAMP(3);

-- Backfill: orders that are already past each stage are marked as handled so
-- turning WhatsApp notifications on doesn't send a late "shipped"/"cancelled"
-- message to customers whose order moved on before this feature existed (the
-- shipped trigger fires on every matching Delhivery scan, not only on the
-- first transition, so an un-backfilled in-transit order would be messaged on
-- its next scan).
UPDATE "Order" SET "confirmationSentAt" = "updatedAt" WHERE "status" <> 'PENDING';
UPDATE "Order" SET "shippedNotifiedAt" = "updatedAt" WHERE "status" IN ('SHIPPED', 'DELIVERED', 'RETURNED', 'CANCELLED');
UPDATE "Order" SET "cancelNotifiedAt" = "updatedAt" WHERE "status" = 'CANCELLED';
