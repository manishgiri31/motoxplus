-- Add the column as nullable first so existing rows aren't rejected before backfill runs.
ALTER TABLE "Product" ADD COLUMN "slug" TEXT;

-- Backfill: derive a base slug from the product name (lowercase, non-alphanumeric
-- runs collapsed to a single hyphen, leading/trailing hyphens trimmed — mirrors
-- src/lib/slug.ts#slugify), then disambiguate collisions by appending the row's
-- rank within that base slug (2, 3, ...) so results stay both short and unique.
WITH base AS (
  SELECT
    id,
    NULLIF(trim(both '-' from regexp_replace(lower(trim(name)), '[^a-z0-9]+', '-', 'g')), '') AS base_slug
  FROM "Product"
),
ranked AS (
  SELECT
    id,
    COALESCE(base_slug, 'product') AS base_slug,
    ROW_NUMBER() OVER (PARTITION BY COALESCE(base_slug, 'product') ORDER BY id) AS rn
  FROM base
)
UPDATE "Product" p
SET slug = CASE WHEN r.rn = 1 THEN r.base_slug ELSE r.base_slug || '-' || r.rn END
FROM ranked r
WHERE p.id = r.id;

-- Enforce the column going forward.
ALTER TABLE "Product" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");
