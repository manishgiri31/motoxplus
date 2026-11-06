-- Automotive parts catalogue for supplier (vendor) applications.
--
-- Additive only: no existing column, row or constraint is removed.
--   * "Category" becomes a two-level tree (nullable "parentId"). Existing categories stay
--     top-level and keep their names, slugs and products.
--   * "VendorPartCategory" links vendors to the categories they supply (structured ids,
--     not comma-separated text). A top-level category covers all of its subcategories.
--   * "Vendor"."category" (the old procurement segment enum) becomes nullable so existing
--     vendors keep their value and new applications no longer need one.

-- CreateEnum
CREATE TYPE "VehicleSegment" AS ENUM ('MOTORCYCLE', 'SCOOTER', 'THREE_WHEELER', 'PASSENGER_CAR', 'COMMERCIAL_VEHICLE', 'OTHER');

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "parentId" TEXT;

-- AlterTable
ALTER TABLE "Vendor" ADD COLUMN     "vehicleSegments" "VehicleSegment"[] DEFAULT ARRAY[]::"VehicleSegment"[],
ALTER COLUMN "category" DROP NOT NULL;

-- CreateTable
CREATE TABLE "VendorPartCategory" (
    "vendorId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorPartCategory_pkey" PRIMARY KEY ("vendorId","categoryId")
);

-- CreateIndex
CREATE INDEX "VendorPartCategory_categoryId_idx" ON "VendorPartCategory"("categoryId");

-- CreateIndex
CREATE INDEX "Category_parentId_sortOrder_idx" ON "Category"("parentId", "sortOrder");

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorPartCategory" ADD CONSTRAINT "VendorPartCategory_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorPartCategory" ADD CONSTRAINT "VendorPartCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed the catalogue. Rows are database-managed from here on (Admin -> Categories).
--
-- An existing category is REUSED rather than duplicated when its slug (or a known alias
-- slug) or its name matches, so e.g. the live "Engine Parts", "Horns" and "Mudguard"
-- categories keep their products and storefront URLs. A reused category only gains a
-- parent (and its position in the group); its name, slug, description and status are
-- left alone. A reused category that already has subcategories is never nested.
DO $seed$
DECLARE
  r RECORD;
  existing_id TEXT;
  group_id TEXT;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
    (1, 0, 'screws-nuts-fasteners', 'Screws, Nuts & Fasteners', NULL, ARRAY[]::text[]),
    (1, 1, 'screws', 'Screws', 'screws-nuts-fasteners', ARRAY[]::text[]),
    (1, 2, 'nuts', 'Nuts', 'screws-nuts-fasteners', ARRAY[]::text[]),
    (1, 3, 'bolts', 'Bolts', 'screws-nuts-fasteners', ARRAY[]::text[]),
    (1, 4, 'washers', 'Washers', 'screws-nuts-fasteners', ARRAY[]::text[]),
    (1, 5, 'clips', 'Clips', 'screws-nuts-fasteners', ARRAY[]::text[]),
    (1, 6, 'clamps', 'Clamps', 'screws-nuts-fasteners', ARRAY[]::text[]),
    (1, 7, 'studs', 'Studs', 'screws-nuts-fasteners', ARRAY[]::text[]),
    (1, 8, 'rivets', 'Rivets', 'screws-nuts-fasteners', ARRAY[]::text[]),
    (1, 9, 'mounting-hardware', 'Mounting Hardware', 'screws-nuts-fasteners', ARRAY[]::text[]),
    (2, 0, 'engine-parts', 'Engine Parts', NULL, ARRAY[]::text[]),
    (2, 1, 'piston-piston-rings', 'Piston & Piston Rings', 'engine-parts', ARRAY[]::text[]),
    (2, 2, 'cylinder-block', 'Cylinder Block', 'engine-parts', ARRAY[]::text[]),
    (2, 3, 'cylinder-head', 'Cylinder Head', 'engine-parts', ARRAY[]::text[]),
    (2, 4, 'valves', 'Valves', 'engine-parts', ARRAY[]::text[]),
    (2, 5, 'camshaft', 'Camshaft', 'engine-parts', ARRAY[]::text[]),
    (2, 6, 'crankshaft', 'Crankshaft', 'engine-parts', ARRAY[]::text[]),
    (2, 7, 'gaskets', 'Gaskets', 'engine-parts', ARRAY[]::text[]),
    (2, 8, 'engine-bearings', 'Engine Bearings', 'engine-parts', ARRAY[]::text[]),
    (2, 9, 'timing-components', 'Timing Components', 'engine-parts', ARRAY[]::text[]),
    (3, 0, 'electrical-parts', 'Electrical Parts', NULL, ARRAY[]::text[]),
    (3, 1, 'wiring-harness', 'Wiring Harness', 'electrical-parts', ARRAY[]::text[]),
    (3, 2, 'ignition-coil', 'Ignition Coil', 'electrical-parts', ARRAY[]::text[]),
    (3, 3, 'cdi-units', 'CDI Units', 'electrical-parts', ARRAY[]::text[]),
    (3, 4, 'sensors', 'Sensors', 'electrical-parts', ARRAY[]::text[]),
    (3, 5, 'relays', 'Relays', 'electrical-parts', ARRAY[]::text[]),
    (3, 6, 'switches', 'Switches', 'electrical-parts', ARRAY[]::text[]),
    (3, 7, 'horns', 'Horns', 'electrical-parts', ARRAY[]::text[]),
    (3, 8, 'batteries', 'Batteries', 'electrical-parts', ARRAY[]::text[]),
    (3, 9, 'regulators', 'Regulators', 'electrical-parts', ARRAY[]::text[]),
    (3, 10, 'starter-motors', 'Starter Motors', 'electrical-parts', ARRAY[]::text[]),
    (4, 0, 'body-parts', 'Body Parts', NULL, ARRAY[]::text[]),
    (4, 1, 'mudguards', 'Mudguards', 'body-parts', ARRAY['mudguard']::text[]),
    (4, 2, 'side-panels', 'Side Panels', 'body-parts', ARRAY[]::text[]),
    (4, 3, 'fuel-tanks', 'Fuel Tanks', 'body-parts', ARRAY[]::text[]),
    (4, 4, 'headlight-visors', 'Headlight Visors', 'body-parts', ARRAY['head-light-visor']::text[]),
    (4, 5, 'side-covers', 'Side Covers', 'body-parts', ARRAY[]::text[]),
    (4, 6, 'front-panels', 'Front Panels', 'body-parts', ARRAY[]::text[]),
    (4, 7, 'rear-panels', 'Rear Panels', 'body-parts', ARRAY[]::text[]),
    (4, 8, 'number-plate-holders', 'Number Plate Holders', 'body-parts', ARRAY[]::text[]),
    (4, 9, 'body-fittings', 'Body Fittings', 'body-parts', ARRAY[]::text[]),
    (5, 0, 'brake-system', 'Brake System', NULL, ARRAY[]::text[]),
    (5, 1, 'brake-shoes', 'Brake Shoes', 'brake-system', ARRAY[]::text[]),
    (5, 2, 'brake-pads', 'Brake Pads', 'brake-system', ARRAY[]::text[]),
    (5, 3, 'brake-discs', 'Brake Discs', 'brake-system', ARRAY[]::text[]),
    (5, 4, 'master-cylinders', 'Master Cylinders', 'brake-system', ARRAY[]::text[]),
    (5, 5, 'brake-cables', 'Brake Cables', 'brake-system', ARRAY[]::text[]),
    (5, 6, 'brake-levers', 'Brake Levers', 'brake-system', ARRAY[]::text[]),
    (5, 7, 'brake-drums', 'Brake Drums', 'brake-system', ARRAY[]::text[]),
    (6, 0, 'suspension-steering', 'Suspension & Steering', NULL, ARRAY[]::text[]),
    (6, 1, 'front-forks', 'Front Forks', 'suspension-steering', ARRAY[]::text[]),
    (6, 2, 'rear-shock-absorbers', 'Rear Shock Absorbers', 'suspension-steering', ARRAY[]::text[]),
    (6, 3, 'suspension-springs', 'Suspension Springs', 'suspension-steering', ARRAY[]::text[]),
    (6, 4, 'steering-bearings', 'Steering Bearings', 'suspension-steering', ARRAY[]::text[]),
    (6, 5, 'handlebar-components', 'Handlebar Components', 'suspension-steering', ARRAY[]::text[]),
    (6, 6, 'suspension-bushes', 'Suspension Bushes', 'suspension-steering', ARRAY[]::text[]),
    (7, 0, 'cables-controls', 'Cables & Controls', NULL, ARRAY[]::text[]),
    (7, 1, 'accelerator-cables', 'Accelerator Cables', 'cables-controls', ARRAY[]::text[]),
    (7, 2, 'clutch-cables', 'Clutch Cables', 'cables-controls', ARRAY[]::text[]),
    (7, 3, 'speedometer-cables', 'Speedometer Cables', 'cables-controls', ARRAY[]::text[]),
    (7, 4, 'front-brake-cables', 'Front Brake Cables', 'cables-controls', ARRAY[]::text[]),
    (7, 5, 'decompression-cables', 'Decompression Cables', 'cables-controls', ARRAY[]::text[]),
    (7, 6, 'control-levers', 'Control Levers', 'cables-controls', ARRAY[]::text[]),
    (8, 0, 'bearings-transmission', 'Bearings & Transmission', NULL, ARRAY[]::text[]),
    (8, 1, 'ball-bearings', 'Ball Bearings', 'bearings-transmission', ARRAY[]::text[]),
    (8, 2, 'roller-bearings', 'Roller Bearings', 'bearings-transmission', ARRAY[]::text[]),
    (8, 3, 'clutch-assemblies', 'Clutch Assemblies', 'bearings-transmission', ARRAY[]::text[]),
    (8, 4, 'clutch-plates', 'Clutch Plates', 'bearings-transmission', ARRAY[]::text[]),
    (8, 5, 'chains', 'Chains', 'bearings-transmission', ARRAY[]::text[]),
    (8, 6, 'sprockets', 'Sprockets', 'bearings-transmission', ARRAY[]::text[]),
    (8, 7, 'gear-components', 'Gear Components', 'bearings-transmission', ARRAY[]::text[]),
    (9, 0, 'lighting-indicators', 'Lighting & Indicators', NULL, ARRAY[]::text[]),
    (9, 1, 'headlights', 'Headlights', 'lighting-indicators', ARRAY[]::text[]),
    (9, 2, 'tail-lights', 'Tail Lights', 'lighting-indicators', ARRAY[]::text[]),
    (9, 3, 'indicators', 'Indicators', 'lighting-indicators', ARRAY[]::text[]),
    (9, 4, 'led-lights', 'LED Lights', 'lighting-indicators', ARRAY[]::text[]),
    (9, 5, 'bulbs', 'Bulbs', 'lighting-indicators', ARRAY[]::text[]),
    (9, 6, 'reflectors', 'Reflectors', 'lighting-indicators', ARRAY[]::text[]),
    (10, 0, 'filters-fuel-system', 'Filters & Fuel System', NULL, ARRAY[]::text[]),
    (10, 1, 'air-filters', 'Air Filters', 'filters-fuel-system', ARRAY[]::text[]),
    (10, 2, 'oil-filters', 'Oil Filters', 'filters-fuel-system', ARRAY[]::text[]),
    (10, 3, 'fuel-filters', 'Fuel Filters', 'filters-fuel-system', ARRAY[]::text[]),
    (10, 4, 'fuel-pumps', 'Fuel Pumps', 'filters-fuel-system', ARRAY[]::text[]),
    (10, 5, 'carburetors', 'Carburetors', 'filters-fuel-system', ARRAY[]::text[]),
    (10, 6, 'fuel-injectors', 'Fuel Injectors', 'filters-fuel-system', ARRAY[]::text[]),
    (10, 7, 'fuel-pipes', 'Fuel Pipes', 'filters-fuel-system', ARRAY[]::text[]),
    (11, 0, 'wheels-tyres', 'Wheels & Tyres', NULL, ARRAY[]::text[]),
    (11, 1, 'alloy-wheels', 'Alloy Wheels', 'wheels-tyres', ARRAY[]::text[]),
    (11, 2, 'wheel-hubs', 'Wheel Hubs', 'wheels-tyres', ARRAY[]::text[]),
    (11, 3, 'rims', 'Rims', 'wheels-tyres', ARRAY[]::text[]),
    (11, 4, 'tyres', 'Tyres', 'wheels-tyres', ARRAY[]::text[]),
    (11, 5, 'tubes', 'Tubes', 'wheels-tyres', ARRAY[]::text[]),
    (11, 6, 'wheel-accessories', 'Wheel Accessories', 'wheels-tyres', ARRAY[]::text[]),
    (12, 0, 'car-spare-parts', 'Car Spare Parts', NULL, ARRAY[]::text[]),
    (12, 1, 'car-engine-parts', 'Car Engine Parts', 'car-spare-parts', ARRAY[]::text[]),
    (12, 2, 'car-electrical-parts', 'Car Electrical Parts', 'car-spare-parts', ARRAY[]::text[]),
    (12, 3, 'car-body-parts', 'Car Body Parts', 'car-spare-parts', ARRAY[]::text[]),
    (12, 4, 'car-brake-parts', 'Car Brake Parts', 'car-spare-parts', ARRAY[]::text[]),
    (12, 5, 'car-suspension-parts', 'Car Suspension Parts', 'car-spare-parts', ARRAY[]::text[]),
    (12, 6, 'car-steering-parts', 'Car Steering Parts', 'car-spare-parts', ARRAY[]::text[]),
    (12, 7, 'car-transmission-parts', 'Car Transmission Parts', 'car-spare-parts', ARRAY[]::text[]),
    (12, 8, 'car-cooling-system', 'Car Cooling System', 'car-spare-parts', ARRAY[]::text[]),
    (12, 9, 'car-lighting', 'Car Lighting', 'car-spare-parts', ARRAY[]::text[]),
    (12, 10, 'car-filters', 'Car Filters', 'car-spare-parts', ARRAY[]::text[]),
    (12, 11, 'car-interior-accessories', 'Car Interior Accessories', 'car-spare-parts', ARRAY[]::text[]),
    (12, 12, 'car-exterior-accessories', 'Car Exterior Accessories', 'car-spare-parts', ARRAY[]::text[]),
    (13, 0, 'other-automotive-parts', 'Other Automotive Parts', NULL, ARRAY[]::text[]),
    (13, 1, 'accessories', 'Accessories', 'other-automotive-parts', ARRAY[]::text[]),
    (13, 2, 'rubber-components', 'Rubber Components', 'other-automotive-parts', ARRAY[]::text[]),
    (13, 3, 'plastic-components', 'Plastic Components', 'other-automotive-parts', ARRAY[]::text[]),
    (13, 4, 'metal-components', 'Metal Components', 'other-automotive-parts', ARRAY[]::text[]),
    (13, 5, 'other-spare-parts', 'Other Spare Parts', 'other-automotive-parts', ARRAY[]::text[])
    ) AS t(group_pos, child_pos, slug, name, parent_slug, aliases)
    ORDER BY group_pos, child_pos
  LOOP
    SELECT c.id INTO existing_id
    FROM "Category" c
    WHERE c.slug = r.slug OR c.slug = ANY (r.aliases) OR lower(c.name) = lower(r.name)
    ORDER BY (c.slug = r.slug) DESC, c."createdAt" ASC
    LIMIT 1;

    IF r.parent_slug IS NULL THEN
      IF existing_id IS NULL THEN
        INSERT INTO "Category" (id, name, slug, "sortOrder", "isActive", "createdAt", "updatedAt")
        VALUES ('cat_' || md5('part-category:' || r.slug), r.name, r.slug, r.group_pos, true, now(), now())
        RETURNING id INTO group_id;
      ELSE
        UPDATE "Category" SET "sortOrder" = r.group_pos, "updatedAt" = now()
        WHERE id = existing_id AND "parentId" IS NULL;
        group_id := existing_id;
      END IF;
    ELSE
      IF existing_id IS NULL THEN
        INSERT INTO "Category" (id, name, slug, "sortOrder", "isActive", "parentId", "createdAt", "updatedAt")
        VALUES ('cat_' || md5('part-category:' || r.slug), r.name, r.slug, r.child_pos, true, group_id, now(), now());
      ELSE
        UPDATE "Category" c SET "parentId" = group_id, "sortOrder" = r.child_pos, "updatedAt" = now()
        WHERE c.id = existing_id
          AND c.id <> group_id
          AND c."parentId" IS NULL
          AND NOT EXISTS (SELECT 1 FROM "Category" k WHERE k."parentId" = c.id);
      END IF;
    END IF;
  END LOOP;
END
$seed$;
