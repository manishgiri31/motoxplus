-- AlterTable: tag every Product with where it actually came from.
-- `vendorId IS NULL` was being used as a stand-in for "our own catalog" in the
-- products-page sort, but it's also true of every eAuto-migrated product (they
-- never got a vendorId), so that sort was a no-op for the 6,852 eAuto rows.
--
-- Backfill order matters: VENDOR is decided by vendorId (authoritative, already
-- correct), then EAUTO_IMPORT is carved out of what's left by SKU range, and
-- everything else defaults to MOTOXPLUS via the column default.
--
-- Range is read from the numeric part of the SKU, not compared as a string —
-- 'MX-12372' sorts before 'MX-5521' lexically, which would silently misclassify
-- the whole 10000+ block. Only SKUs matching '^MX-[0-9]+$' are touched; other
-- prefixes (MX-CB..., MQX...) are intentionally left alone and fall through to
-- the MOTOXPLUS default.
CREATE TYPE "ProductSource" AS ENUM ('MOTOXPLUS', 'EAUTO_IMPORT', 'VENDOR');

ALTER TABLE "Product" ADD COLUMN "source" "ProductSource" NOT NULL DEFAULT 'MOTOXPLUS';

UPDATE "Product" SET source = 'VENDOR' WHERE "vendorId" IS NOT NULL;

UPDATE "Product" SET source = 'EAUTO_IMPORT'
WHERE "vendorId" IS NULL
  AND sku ~ '^MX-[0-9]+$'
  AND CAST(substring(sku from 'MX-([0-9]+)') AS INTEGER) BETWEEN 5521 AND 12372;
