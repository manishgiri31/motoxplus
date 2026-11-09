-- Fixed seed for the GET /api/categories contract fixture (categories.json).
-- The SAME file is (1) loaded into a scratch PostgreSQL to capture the Node route's response and
-- (2) loaded by CategoriesContractTest before it calls the Java endpoint. Synthetic data only.
-- The route orders by sortOrder then name; sortOrder ties are deliberate (Lamps/Lighting) to pin the tiebreaker.
-- Only "browsable" categories are returned: active, with an active product of their own or in an active
-- subcategory (src/lib/catalog/storefront-categories.ts). Early Bird, Filters and Empty Category stay in the
-- seed to prove what is hidden.

INSERT INTO "Category" (id, name, slug, description, image, "sortOrder", "isActive", "createdAt", "updatedAt") VALUES
  ('cat_fx_early',   'Early Bird',     'early-bird',     NULL,                                              NULL,                                             -1, true,  '2026-01-03 09:15:00.007', '2026-01-03 09:15:00.007'),
  ('cat_fx_engine',  'Engine',         'engine',         'Engine & drivetrain parts',                       NULL,                                              0, true,  '2026-01-01 10:00:00.123', '2026-01-02 11:30:45.500'),
  ('cat_fx_brakes',  'Brakes',         'brakes',         'Pads, discs & "quoted" <tags> ünïcode ₹',         'https://cdn.example.test/categories/brakes.png',  1, true,  '2026-02-01 00:00:00.000', '2026-02-01 00:00:00.001'),
  ('cat_fx_filters', 'Filters',        'filters',        NULL,                                              'https://cdn.example.test/categories/filters.png', 2, true,  '2026-03-15 23:59:59.999', '2026-03-16 00:00:00.000'),
  ('cat_fx_hidden',  'Hidden',         'hidden',         'Inactive: must not be returned',                  NULL,                                              3, false, '2026-01-01 00:00:00.000', '2026-01-01 00:00:00.000'),
  ('cat_fx_empty',   'Empty Category', 'empty-category', '',                                                NULL,                                              5, true,  '2026-04-01 12:00:00.000', '2026-04-01 12:00:00.000');

-- Prisma's _count.products counts EVERY product in the category, active or not.
INSERT INTO "Product" (id, name, sku, "partNumber", "categoryId", price, brand, slug, "isActive", compatibility, images, "updatedAt") VALUES
  ('prod_fx_e1', 'Oil Seal',       'sku-fx-e1', 'PN-E1', 'cat_fx_engine',  499,  'Acme',  'oil-seal',       true,  '{}', '{}', '2026-01-01 00:00:00.000'),
  ('prod_fx_e2', 'Gasket Kit',     'sku-fx-e2', 'PN-E2', 'cat_fx_engine',  1299, 'Acme',  'gasket-kit',     true,  '{}', '{}', '2026-01-01 00:00:00.000'),
  ('prod_fx_e3', 'Retired Piston', 'sku-fx-e3', 'PN-E3', 'cat_fx_engine',  2999, 'Acme',  'retired-piston', false, '{}', '{}', '2026-01-01 00:00:00.000'),
  ('prod_fx_b1', 'Brake Pad Set',  'sku-fx-b1', 'PN-B1', 'cat_fx_brakes',  799,  'Binda', 'brake-pad-set',  true,  '{}', '{}', '2026-01-01 00:00:00.000'),
  ('prod_fx_f1', 'Oil Filter',     'sku-fx-f1', 'PN-F1', 'cat_fx_filters', 199,  'Binda', 'oil-filter',     false, '{}', '{}', '2026-01-01 00:00:00.000'),
  ('prod_fx_f2', 'Air Filter',     'sku-fx-f2', 'PN-F2', 'cat_fx_filters', 349,  'Binda', 'air-filter',     false, '{}', '{}', '2026-01-01 00:00:00.000'),
  ('prod_fx_h1', 'Hidden Widget',  'sku-fx-h1', 'PN-H1', 'cat_fx_hidden',  99,   'Acme',  'hidden-widget',  true,  '{}', '{}', '2026-01-01 00:00:00.000');

-- Two-level tree: Lighting has no products of its own but is shown because its subcategory Bulbs has an active
-- product; LED Lights (empty) is hidden; Signals is hidden (its only product sits in an inactive subcategory).
INSERT INTO "Category" (id, name, slug, description, image, "sortOrder", "isActive", "parentId", "createdAt", "updatedAt") VALUES
  ('cat_fx_lighting', 'Lighting',      'lighting',      NULL, NULL, 6, true,  NULL,              '2026-05-01 00:00:00.000', '2026-05-01 00:00:00.000'),
  ('cat_fx_lamps',    'Lamps',         'lamps',         NULL, NULL, 6, true,  NULL,              '2026-05-01 00:00:00.000', '2026-05-01 00:00:00.000'),
  ('cat_fx_bulbs',    'Bulbs',         'bulbs',         NULL, NULL, 1, true,  'cat_fx_lighting', '2026-05-02 00:00:00.000', '2026-05-02 00:00:00.000'),
  ('cat_fx_leds',     'LED Lights',    'led-lights',    NULL, NULL, 2, true,  'cat_fx_lighting', '2026-05-02 00:00:00.000', '2026-05-02 00:00:00.000'),
  ('cat_fx_signals',  'Signals',       'signals',       NULL, NULL, 7, true,  NULL,              '2026-05-01 00:00:00.000', '2026-05-01 00:00:00.000'),
  ('cat_fx_retired',  'Retired Lamps', 'retired-lamps', NULL, NULL, 3, false, 'cat_fx_signals',  '2026-05-02 00:00:00.000', '2026-05-02 00:00:00.000');

INSERT INTO "Product" (id, name, sku, "partNumber", "categoryId", price, brand, slug, "isActive", compatibility, images, "updatedAt") VALUES
  ('prod_fx_l1', 'H4 Bulb',      'sku-fx-l1', 'PN-L1', 'cat_fx_bulbs',   149, 'Lumo', 'h4-bulb',      true, '{}', '{}', '2026-01-01 00:00:00.000'),
  ('prod_fx_m1', 'Tail Lamp',    'sku-fx-m1', 'PN-M1', 'cat_fx_lamps',   399, 'Lumo', 'tail-lamp',    true, '{}', '{}', '2026-01-01 00:00:00.000'),
  -- Signals has an active product only in an INACTIVE subcategory, so Signals is hidden.
  ('prod_fx_r1', 'Old Lamp',     'sku-fx-r1', 'PN-R1', 'cat_fx_retired', 99,  'Lumo', 'old-lamp',     true, '{}', '{}', '2026-01-01 00:00:00.000');
