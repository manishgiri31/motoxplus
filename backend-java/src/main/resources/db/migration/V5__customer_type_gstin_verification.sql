-- B2B / B2C customer classification + live GSTIN verification.
--
-- Additive only: new enums, nullable columns (or columns with defaults), a backfill derived from data that
-- already exists, and one trigger. No existing column, constraint or row is removed. Mirrored by hand in
-- prisma/schema.prisma (Prisma migrations are frozen; see backend-java/README.md).

-- ---------------------------------------------------------------------------------------------------------
-- 1. Customer type, stored permanently on the account.
--    B2B = dealer (trade account, GSTIN-registered). B2C = retail customer (no GSTIN).
--    NULL for accounts that never buy (admin, staff, vendor).
-- ---------------------------------------------------------------------------------------------------------
CREATE TYPE "CustomerType" AS ENUM ('B2B', 'B2C');

ALTER TABLE public."User" ADD COLUMN "customerType" "CustomerType";

UPDATE public."User" SET "customerType" = 'B2B' WHERE role = 'DEALER'   AND "customerType" IS NULL;
UPDATE public."User" SET "customerType" = 'B2C' WHERE role = 'CUSTOMER' AND "customerType" IS NULL;

CREATE INDEX "User_customerType_idx" ON public."User" ("customerType");

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

CREATE TRIGGER "User_customerType_guard"
    BEFORE INSERT OR UPDATE OF "customerType", role ON public."User"
    FOR EACH ROW EXECUTE FUNCTION public.mx_user_customer_type();

-- ---------------------------------------------------------------------------------------------------------
-- 2. GSTIN verification details on the dealer (B2B) record.
--    gstVerified / gstVerifiedAt keep their meaning ("this GSTIN may be printed on a tax invoice").
-- ---------------------------------------------------------------------------------------------------------
CREATE TYPE "GstinVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'INVALID', 'INACTIVE');

ALTER TABLE public."Dealer"
    ADD COLUMN "gstVerificationStatus" "GstinVerificationStatus",
    -- 'GST_API' (checked live against the GST registry) or 'ADMIN' (confirmed by staff by hand).
    ADD COLUMN "gstVerificationSource" TEXT,
    ADD COLUMN "gstLegalName"          TEXT,
    ADD COLUMN "gstTradeName"          TEXT,
    -- The registry's own status text, verbatim (e.g. 'Active', 'Cancelled', 'Suspended').
    ADD COLUMN "gstRegistrationStatus" TEXT,
    -- Principal place of business as registered; used as the dealer's GST billing address.
    ADD COLUMN "gstPrincipalAddress"   TEXT,
    ADD COLUMN "gstLastCheckedAt"      TIMESTAMP(3),
    ADD COLUMN "gstCheckAttempts"      INTEGER NOT NULL DEFAULT 0;

-- Already confirmed by staff through the existing admin button.
UPDATE public."Dealer"
   SET "gstVerificationStatus" = 'VERIFIED', "gstVerificationSource" = 'ADMIN'
 WHERE "gstVerified" = true AND "gstNumber" IS NOT NULL;

-- GSTIN on file but never confirmed: queue it for the live re-check job (GstinRecheckJob). Nothing else on
-- the row changes; until the check succeeds the GSTIN is simply not printed on new invoices.
UPDATE public."Dealer"
   SET "gstVerificationStatus" = 'PENDING'
 WHERE "gstVerified" = false AND "gstNumber" IS NOT NULL;

CREATE INDEX "Dealer_gstVerificationStatus_idx" ON public."Dealer" ("gstVerificationStatus");

-- ---------------------------------------------------------------------------------------------------------
-- 3. B2C customer's saved delivery address (latest one used at checkout). Name and mobile live on "User".
-- ---------------------------------------------------------------------------------------------------------
ALTER TABLE public."Customer"
    ADD COLUMN "deliveryAddress" TEXT,
    ADD COLUMN "deliveryCity"    TEXT,
    ADD COLUMN "deliveryState"   TEXT,
    ADD COLUMN "deliveryPincode" TEXT;

-- ---------------------------------------------------------------------------------------------------------
-- 4. Buyer GSTIN frozen onto the invoice when it is issued (a tax invoice must not change if the dealer's
--    profile changes later). NULL on B2C invoices and on B2B invoices to a dealer without a verified GSTIN.
-- ---------------------------------------------------------------------------------------------------------
ALTER TABLE public."Invoice" ADD COLUMN "buyerGstin" TEXT;

-- Existing invoices already display the dealer's current GSTIN; freeze exactly that so nothing they show
-- changes after this migration.
UPDATE public."Invoice" i
   SET "buyerGstin" = d."gstNumber"
  FROM public."Dealer" d
 WHERE i."dealerId" = d.id AND i."buyerGstin" IS NULL AND d."gstNumber" IS NOT NULL;
