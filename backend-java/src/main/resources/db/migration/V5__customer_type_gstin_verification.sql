-- B2B / B2C customer classification + live GSTIN verification.
--
-- Idempotent on purpose: production received the same columns/enums from Prisma migration
-- 20261112000000_sync_schema before Flyway took over, so every step here is "create if missing". On an empty
-- database it does exactly what it always did; on production it only adds what Prisma could not (the trigger,
-- the backfills).
--
-- Additive only: new enums, nullable columns (or columns with defaults), a backfill derived from data that
-- already exists, and one trigger. No existing column, constraint or row is removed. Mirrored by hand in
-- prisma/schema.prisma (Prisma migrations are frozen; see backend-java/README.md).

-- ---------------------------------------------------------------------------------------------------------
-- 1. Customer type, stored permanently on the account.
--    B2B = dealer (trade account, GSTIN-registered). B2C = retail customer (no GSTIN).
--    NULL for accounts that never buy (admin, staff, vendor).
-- ---------------------------------------------------------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE "CustomerType" AS ENUM ('B2B', 'B2C');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public."User" ADD COLUMN IF NOT EXISTS "customerType" "CustomerType";

UPDATE public."User" SET "customerType" = 'B2B' WHERE role = 'DEALER'   AND "customerType" IS NULL;
UPDATE public."User" SET "customerType" = 'B2C' WHERE role = 'CUSTOMER' AND "customerType" IS NULL;

CREATE INDEX IF NOT EXISTS "User_customerType_idx" ON public."User" ("customerType");

-- One trigger for every write path (Node routes, Java services, CRM lead conversion, manual SQL):
--  * a buying account created or re-roled without a customerType gets the one its role implies;
--  * a B2B account can never become B2C (or lose its type, or be re-roled to CUSTOMER) unless the writer has
--    explicitly opted in for this transaction with  SET LOCAL app.customer_type_change = 'approved'
--    (the "appropriate account update process": an admin-run, audited change, never a customer action).
CREATE OR REPLACE FUNCTION public.mx_user_customer_type() RETURNS trigger
    LANGUAGE plpgsql AS $$
BEGIN
    IF NEW."customerType" IS NULL THEN
        IF NEW.role = 'DEALER' THEN
            NEW."customerType" := 'B2B';
        ELSIF NEW.role = 'CUSTOMER' THEN
            NEW."customerType" := 'B2C';
        END IF;
    END IF;

    IF TG_OP = 'UPDATE'
       AND OLD."customerType" = 'B2B'
       AND (NEW."customerType" IS DISTINCT FROM 'B2B' OR NEW.role = 'CUSTOMER')
       AND coalesce(current_setting('app.customer_type_change', true), '') <> 'approved' THEN
        RAISE EXCEPTION 'A B2B (dealer) account cannot be changed to B2C without an approved account update'
            USING ERRCODE = 'check_violation';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "User_customerType_guard" ON public."User";
CREATE TRIGGER "User_customerType_guard"
    BEFORE INSERT OR UPDATE OF "customerType", role ON public."User"
    FOR EACH ROW EXECUTE FUNCTION public.mx_user_customer_type();

-- ---------------------------------------------------------------------------------------------------------
-- 2. GSTIN verification details on the dealer (B2B) record.
--    gstVerified / gstVerifiedAt keep their meaning ("this GSTIN may be printed on a tax invoice").
-- ---------------------------------------------------------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE "GstinVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'INVALID', 'INACTIVE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public."Dealer"
    ADD COLUMN IF NOT EXISTS "gstVerificationStatus" "GstinVerificationStatus",
    -- 'GST_API' (checked live against the GST registry) or 'ADMIN' (confirmed by staff by hand).
    ADD COLUMN IF NOT EXISTS "gstVerificationSource" TEXT,
    ADD COLUMN IF NOT EXISTS "gstLegalName"          TEXT,
    ADD COLUMN IF NOT EXISTS "gstTradeName"          TEXT,
    -- The registry's own status text, verbatim (e.g. 'Active', 'Cancelled', 'Suspended').
    ADD COLUMN IF NOT EXISTS "gstRegistrationStatus" TEXT,
    -- Principal place of business as registered; used as the dealer's GST billing address.
    ADD COLUMN IF NOT EXISTS "gstPrincipalAddress"   TEXT,
    ADD COLUMN IF NOT EXISTS "gstLastCheckedAt"      TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "gstCheckAttempts"      INTEGER NOT NULL DEFAULT 0;

-- Already confirmed by staff through the existing admin button.
UPDATE public."Dealer"
   SET "gstVerificationStatus" = 'VERIFIED', "gstVerificationSource" = 'ADMIN'
 WHERE "gstVerified" = true AND "gstNumber" IS NOT NULL AND "gstVerificationStatus" IS NULL;

-- GSTIN on file but never confirmed: queue it for the live re-check job (GstinRecheckJob). Nothing else on
-- the row changes; until the check succeeds the GSTIN is simply not printed on new invoices.
UPDATE public."Dealer"
   SET "gstVerificationStatus" = 'PENDING'
 WHERE "gstVerified" = false AND "gstNumber" IS NOT NULL AND "gstVerificationStatus" IS NULL;

CREATE INDEX IF NOT EXISTS "Dealer_gstVerificationStatus_idx" ON public."Dealer" ("gstVerificationStatus");

-- ---------------------------------------------------------------------------------------------------------
-- 3. B2C customer's saved delivery address (latest one used at checkout). Name and mobile live on "User".
-- ---------------------------------------------------------------------------------------------------------
ALTER TABLE public."Customer"
    ADD COLUMN IF NOT EXISTS "deliveryAddress" TEXT,
    ADD COLUMN IF NOT EXISTS "deliveryCity"    TEXT,
    ADD COLUMN IF NOT EXISTS "deliveryState"   TEXT,
    ADD COLUMN IF NOT EXISTS "deliveryPincode" TEXT;

-- ---------------------------------------------------------------------------------------------------------
-- 4. Buyer GSTIN frozen onto the invoice when it is issued (a tax invoice must not change if the dealer's
--    profile changes later). NULL on B2C invoices and on B2B invoices to a dealer without a verified GSTIN.
-- ---------------------------------------------------------------------------------------------------------
ALTER TABLE public."Invoice" ADD COLUMN IF NOT EXISTS "buyerGstin" TEXT;

-- Existing invoices already display the dealer's current GSTIN; freeze exactly that so nothing they show
-- changes after this migration.
UPDATE public."Invoice" i
   SET "buyerGstin" = d."gstNumber"
  FROM public."Dealer" d
 WHERE i."dealerId" = d.id AND i."buyerGstin" IS NULL AND d."gstNumber" IS NOT NULL;
