-- CreateEnum
CREATE TYPE "OrderChannel" AS ENUM ('B2B', 'B2C');

-- AlterTable
-- Additive, no backfill statement needed: NOT NULL DEFAULT 'B2B' on ADD COLUMN
-- sets every existing row to 'B2B' in this same statement (Postgres 11+,
-- non-volatile constant default — no table rewrite/lock beyond the DDL
-- itself). Every Order placed through this app to date is a B2B dealer
-- order, so 'B2B' is not a placeholder — it is the correct historical value.
ALTER TABLE "Order" ADD COLUMN     "channel" "OrderChannel" NOT NULL DEFAULT 'B2B';

-- AlterTable
-- Same reasoning as Order.channel above.
ALTER TABLE "Invoice" ADD COLUMN     "channel" "OrderChannel" NOT NULL DEFAULT 'B2B';
