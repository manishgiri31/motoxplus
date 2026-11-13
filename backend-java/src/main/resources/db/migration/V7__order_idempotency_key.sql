-- V7: Order idempotency key (mirror of Prisma migration 20261112100000_order_idempotency_key).
--
-- Node checkout stores the client's idempotency key on the order so a retried "place order" never creates a
-- second order. Production already has this from Prisma; a database built only by Flyway did not. Idempotent, so
-- it is a no-op on production and creates the column + indexes everywhere else.

ALTER TABLE public."Order" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Order_dealerId_idempotencyKey_key" ON public."Order" ("dealerId", "idempotencyKey");
CREATE UNIQUE INDEX IF NOT EXISTS "Order_customerId_idempotencyKey_key" ON public."Order" ("customerId", "idempotencyKey");
