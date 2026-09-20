-- AlterTable
-- Additive, no backfill needed: NOT NULL DEFAULT 0 sets every existing row's
-- cgst/sgst/igst to 0 in this same statement. Every Order placed to date
-- predates the GST split (lib/tax/gst-split.ts) — 0/0/0 alongside the
-- existing (unsplit) gstAmount is the correct historical value, not a
-- placeholder. placeOfSupply is nullable with no default for the same
-- reason: old orders never recorded one.
ALTER TABLE "Order" ADD COLUMN     "cgstAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "sgstAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "igstAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "placeOfSupply" TEXT;

-- AlterTable
-- Same reasoning as Order's columns above.
ALTER TABLE "Invoice" ADD COLUMN     "cgstAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "sgstAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "igstAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "placeOfSupply" TEXT;
