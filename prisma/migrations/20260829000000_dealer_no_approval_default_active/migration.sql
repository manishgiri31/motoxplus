-- Dealers no longer require admin approval at sign-up: new dealer accounts are
-- ACTIVE immediately. Admin retains the ability to SUSPEND / re-ACTIVATE.

-- AlterTable
ALTER TABLE "Dealer" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

-- Promote any dealer left waiting in the old approval queue to ACTIVE.
UPDATE "Dealer" SET "status" = 'ACTIVE' WHERE "status" = 'PENDING';
