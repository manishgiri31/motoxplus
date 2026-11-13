-- V6: Delhivery pickup warehouses (one per vendor, plus at most one MotoXPlus row) and the order's pickup location.
--
-- A vendor's goods are collected from the vendor, not from MotoXPlus, so every vendor needs its own warehouse
-- registered on our Delhivery (B2C) client. The Java API creates the row (PENDING), calls Delhivery, and marks it
-- ACTIVE or FAILED (com.motoxplus.api.vendor.warehouse). A vendor cannot publish a listing, and checkout refuses
-- that vendor's products, until the row is ACTIVE.
--
-- Named "DelhiveryWarehouse" because public."Warehouse" already exists (an older Prisma model no code reads). It is
-- left untouched here; drop it in a later migration once production is confirmed to hold nothing in it.
--
-- Additive only: new enums, one new table, one nullable column on "Order". Mirrored by hand in prisma/schema.prisma
-- (Prisma migrations are frozen; see docs/marketplace/DB-TAKEOVER.md) because Node checkout reads it.
--
-- Idempotent on purpose: production received the enums, the table (without its CHECK constraints) and the Order
-- column from Prisma migration 20261112000000_sync_schema before Flyway took over. Every step is "create if
-- missing"; the CHECK constraints are added afterwards under the names PostgreSQL gives them on an empty database.

DO $$ BEGIN
    CREATE TYPE "WarehouseOwnerType" AS ENUM ('MOTOXPLUS', 'VENDOR');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    CREATE TYPE "WarehouseStatus" AS ENUM ('PENDING', 'ACTIVE', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public."DelhiveryWarehouse" (
    id                 text PRIMARY KEY,
    "ownerType"        "WarehouseOwnerType" NOT NULL,
    -- One warehouse per vendor: a retry or a second submit can never register a second one.
    "vendorId"         text UNIQUE REFERENCES public."Vendor" (id) ON DELETE RESTRICT,
    -- The name Delhivery knows the warehouse by (create.json pickup_location.name, pickup requests). Permanent once
    -- Delhivery may have seen it, so it is reserved here (unique) BEFORE the Delhivery call is made.
    "delhiveryName"    text NOT NULL UNIQUE CHECK ("delhiveryName" ~ '^[A-Z0-9-]+$' OR "ownerType" = 'MOTOXPLUS'),

    address            text NOT NULL CHECK (length(address) BETWEEN 5 AND 300),
    pin                text NOT NULL CHECK (pin ~ '^[1-9][0-9]{5}$'),
    city               text NOT NULL CHECK (length(city) BETWEEN 2 AND 80),
    state              text NOT NULL CHECK (length(state) BETWEEN 2 AND 80),
    phone              text NOT NULL CHECK (phone ~ '^[6-9][0-9]{9}$'),
    email              text NOT NULL CHECK (length(email) BETWEEN 3 AND 254),
    "returnAddress"    text NOT NULL CHECK (length("returnAddress") BETWEEN 5 AND 300),
    "returnPin"        text NOT NULL CHECK ("returnPin" ~ '^[1-9][0-9]{5}$'),
    "returnCity"       text NOT NULL CHECK (length("returnCity") BETWEEN 2 AND 80),
    "returnState"      text NOT NULL CHECK (length("returnState") BETWEEN 2 AND 80),
    gstin              text CHECK (gstin IS NULL OR gstin ~ '^[0-9]{2}[A-Z0-9]{13}$'),

    status             "WarehouseStatus" NOT NULL DEFAULT 'PENDING',
    -- Why the last attempt failed, for the vendor and support. Never contains the API token.
    "lastError"        text CHECK ("lastError" IS NULL OR length("lastError") <= 1000),
    -- REJECTED / NOT_SENT: Delhivery definitely did not create it, so the details may still be corrected.
    -- UNCERTAIN: it may exist on Delhivery (timeout, 5xx, unreadable answer), so the details are frozen; retry only.
    "lastErrorCode"    text CHECK ("lastErrorCode" IS NULL OR "lastErrorCode" IN ('REJECTED', 'NOT_SENT', 'UNCERTAIN')),
    attempts           integer NOT NULL DEFAULT 0,
    -- Set while a Delhivery call is in flight; a PENDING row whose attempt is old was abandoned (crash) and may be retried.
    "attemptStartedAt" timestamp(3),
    "activatedAt"      timestamp(3),
    "createdAt"        timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DelhiveryWarehouse_owner_check" CHECK (("ownerType" = 'VENDOR') = ("vendorId" IS NOT NULL)),
    CONSTRAINT "DelhiveryWarehouse_active_check" CHECK (status <> 'ACTIVE' OR "activatedAt" IS NOT NULL)
);

-- A table that Prisma created has none of the CHECK constraints above; add each one that is missing.
DO $$
DECLARE
    c record;
BEGIN
    FOR c IN SELECT * FROM (VALUES
        ('DelhiveryWarehouse_delhiveryName_check', $c$CHECK ("delhiveryName" ~ '^[A-Z0-9-]+$' OR "ownerType" = 'MOTOXPLUS')$c$),
        ('DelhiveryWarehouse_address_check', $c$CHECK (length(address) BETWEEN 5 AND 300)$c$),
        ('DelhiveryWarehouse_pin_check', $c$CHECK (pin ~ '^[1-9][0-9]{5}$')$c$),
        ('DelhiveryWarehouse_city_check', $c$CHECK (length(city) BETWEEN 2 AND 80)$c$),
        ('DelhiveryWarehouse_state_check', $c$CHECK (length(state) BETWEEN 2 AND 80)$c$),
        ('DelhiveryWarehouse_phone_check', $c$CHECK (phone ~ '^[6-9][0-9]{9}$')$c$),
        ('DelhiveryWarehouse_email_check', $c$CHECK (length(email) BETWEEN 3 AND 254)$c$),
        ('DelhiveryWarehouse_returnAddress_check', $c$CHECK (length("returnAddress") BETWEEN 5 AND 300)$c$),
        ('DelhiveryWarehouse_returnPin_check', $c$CHECK ("returnPin" ~ '^[1-9][0-9]{5}$')$c$),
        ('DelhiveryWarehouse_returnCity_check', $c$CHECK (length("returnCity") BETWEEN 2 AND 80)$c$),
        ('DelhiveryWarehouse_returnState_check', $c$CHECK (length("returnState") BETWEEN 2 AND 80)$c$),
        ('DelhiveryWarehouse_gstin_check', $c$CHECK (gstin IS NULL OR gstin ~ '^[0-9]{2}[A-Z0-9]{13}$')$c$),
        ('DelhiveryWarehouse_lastError_check', $c$CHECK ("lastError" IS NULL OR length("lastError") <= 1000)$c$),
        ('DelhiveryWarehouse_lastErrorCode_check', $c$CHECK ("lastErrorCode" IS NULL OR "lastErrorCode" IN ('REJECTED', 'NOT_SENT', 'UNCERTAIN'))$c$),
        ('DelhiveryWarehouse_owner_check', $c$CHECK (("ownerType" = 'VENDOR') = ("vendorId" IS NOT NULL))$c$),
        ('DelhiveryWarehouse_active_check', $c$CHECK (status <> 'ACTIVE' OR "activatedAt" IS NOT NULL)$c$)
    ) AS t(name, def)
    LOOP
        IF NOT EXISTS (SELECT 1 FROM pg_constraint
                        WHERE conrelid = 'public."DelhiveryWarehouse"'::regclass AND conname = c.name) THEN
            EXECUTE format('ALTER TABLE public."DelhiveryWarehouse" ADD CONSTRAINT %I %s', c.name, c.def);
        END IF;
    END LOOP;
END $$;

-- At most one MotoXPlus warehouse row. Without one, MotoXPlus's own products ship from the pickup location already
-- configured in the environment (DELHIVERY_PICKUP_LOCATION_NAME), exactly as before this migration.
CREATE UNIQUE INDEX IF NOT EXISTS "DelhiveryWarehouse_one_motoxplus_idx" ON public."DelhiveryWarehouse" ("ownerType") WHERE "ownerType" = 'MOTOXPLUS';
CREATE INDEX IF NOT EXISTS "DelhiveryWarehouse_status_idx" ON public."DelhiveryWarehouse" (status);

-- The Delhivery pickup location an order ships from, fixed at checkout. NULL on orders placed before V6: those ship
-- from the configured MotoXPlus location, as they always did.
ALTER TABLE public."Order" ADD COLUMN IF NOT EXISTS "pickupLocationName" text;
CREATE INDEX IF NOT EXISTS "Order_pickupLocationName_idx" ON public."Order" ("pickupLocationName");

-- Vendors set up and retry their own warehouse.
INSERT INTO marketplace.permission (code, description) VALUES
    ('vendor.warehouse.manage', 'Set up and retry own Delhivery pickup warehouse');
INSERT INTO marketplace.role_permission (role, permission_code) VALUES ('VENDOR', 'vendor.warehouse.manage');
