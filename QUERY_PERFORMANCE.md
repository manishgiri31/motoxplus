# Query performance: slow-query logging and missing indexes

**Status: nothing in this document has been applied to the schema or any database.** It lists what to add and
shows the evidence; you decide and apply.

## 1. Slow-query logging (now on)

`src/lib/prisma.ts` logs every query that takes **200 ms or more** as one JSON line on stdout (PM2 captures it):

```json
{"ts":"2026-11-05T10:12:01.000Z","level":"warn","msg":"Slow query","durationMs":412,"thresholdMs":200,
 "shape":"SELECT ... FROM \"OrderItem\" WHERE \"orderId\" IN ($?...)"}
```

* Override the threshold with `SLOW_QUERY_MS` in `.env` (`100` while tuning, `0` to log everything).
* Only the SQL **shape** is logged (whitespace squeezed, `$1,$2...` -> `$?`, `IN (...)` lists collapsed), so the same
  statement with different values groups together: `grep "Slow query" ~/.pm2/logs/motoxplus-out.log | jq -r .shape | sort | uniq -c | sort -rn | head`.
* **Bound parameters are never logged.** They contain emails, phone numbers, OTP hashes and password hashes.
* Cost: Prisma now emits an event per query; the handler returns immediately for fast ones.
* Code: `src/lib/slow-query.ts` (tested in `slow-query.test.ts`).

## 2. How the "10 slowest" were chosen, and the caveat that matters

I could not reach your production database from here (it is only reachable through your SSH tunnel, which was not
open). So these are **not** production measurements. Instead:

1. I picked 12 query shapes from the code that run on every storefront/admin page load (file references in the table).
2. I created a throwaway PostgreSQL 18 from your real `schema.prisma`, with the **real indexes**, and seeded it with
   an assumed size: 20,000 products, 60,000 product images, 100,000 orders, 400,000 order items, 100,000 payments,
   60,000 shipments (300,000 tracking events), 90,000 invoices, 2,000 dealers.
3. Ran `EXPLAIN (ANALYZE, BUFFERS)` on each. Then, in that scratch DB only, added the candidate indexes and ran them again.

Treat the *plans* (scan type) as reliable: they depend on the schema and the queries, not on your exact data. Treat the
*milliseconds* as relative: your real tables may be smaller or larger. Confirm on real data with
`scripts/db/explain-hot-queries.sql` (read-only, run on the server) and, for the true top 10, `pg_stat_statements`
(instructions at the bottom of that script).

## 3. Results

| # | Query shape (where it runs) | Plan today | Today | With candidate index |
|---|---|---|---|---|
| Q5 | Line items for the 10 orders on a page (`GET /api/orders`, order pages) | **Full scan of OrderItem** | 76.8 ms | 0.5 ms |
| Q10 | Latest tracking event per shipment (`/api/admin/shipments`) | **Full scan of ShipmentTrackingEvent** | 44.5 ms | 0.5 ms |
| Q4 | Search by vehicle compatibility (`unnest(compatibility) ILIKE`) | Full scan of Product | 41.3 ms | 41.6 ms (no change, see below) |
| Q2 | Images for a page of 12 products (every catalog page) | **Full scan of ProductImage** | 19.7 ms | 0.2 ms |
| Q3 | Search by name / part no. / SKU / brand (`ILIKE '%x%'`) | Full scan of Product | 19.0 ms | 3.3 ms |
| Q7 | Admin dashboard: active dealers + total paid revenue | Full scans (see below) | 13.1 ms | 17.2 ms (no change) |
| Q9 | Admin shipments list, newest first | Full scan + sort of Shipment | 8.9 ms | 0.09 ms |
| Q11 | A dealer's invoices (`/dealer/invoices`) | **Full scan of Invoice** | 8.7 ms | 0.07 ms |
| Q8 | Admin payment submissions by status | Index + top-N sort | 2.5 ms | 0.08 ms |
| Q1 | Storefront product list (category + active, ordered) | Index + small sort | 1.7 ms | 0.9 ms |
| Q6 | Dealer order history | Index (already good) | 1.3 ms | 0.3 ms |
| Q12 | Admin dealers list by status | Full scan (2k rows, harmless) | 0.7 ms | 0.1 ms |

Q5, Q10, Q2 and Q11 are the dangerous kind: the cost grows with the **whole table**, not with the rows returned, and
they run on every page view. At 100k+ orders the OrderItem scan alone would dominate a dealer's order page.

## 4. Missing indexes (not applied)

Highest value first. Each is a plain B-tree unless stated.

| Priority | Index | Fixes | Notes |
|---|---|---|---|
| 1 | `OrderItem("orderId")` | Q5 | Also speeds order delete/cancel (FK check). |
| 1 | `ShipmentTrackingEvent("shipmentId", "timestamp" DESC)` | Q10 | |
| 1 | `ProductImage("productId", "isPrimary" DESC, "sortOrder")` | Q2 | Matches the `ORDER BY` the app always uses. |
| 1 | `Invoice("dealerId", "createdAt" DESC)` | Q11 | `Invoice` only has `customerId` indexed today. |
| 2 | GIN trigram on `Product(name)`, `("partNumber")`, `(sku)`, `(brand)` | Q3 | Needs the `pg_trgm` extension; Prisma cannot declare it, so it must be a raw SQL migration. |
| 2 | `Shipment("status", "createdAt")` | Q9 + status filter | |
| 3 | `PaymentSubmission("status", "submittedAt" DESC)` | Q8 | Existing index is on `createdAt` but the query sorts by `submittedAt`. |
| 3 | `Dealer("status", "createdAt" DESC)` | Q12 | Tiny table today; matters only if dealers reach tens of thousands. |

Prisma schema lines for the B-tree ones (`prisma/schema.prisma`; then `prisma migrate dev` / `migrate deploy`):

```prisma
model OrderItem             { @@index([orderId]) }
model ShipmentTrackingEvent { @@index([shipmentId, timestamp(sort: Desc)]) }
model ProductImage          { @@index([productId, isPrimary(sort: Desc), sortOrder]) }
model Invoice               { @@index([dealerId, createdAt(sort: Desc)]) }
model Shipment              { @@index([status, createdAt(sort: Desc)]) }
model PaymentSubmission     { @@index([status, submittedAt(sort: Desc)]) }
model Dealer                { @@index([status, createdAt(sort: Desc)]) }
```

(Add these lines inside the existing models; they are shown as separate blocks only for brevity.)

Trigram search (raw SQL migration; `sudo apt install postgresql-contrib` if `pg_trgm` is missing):

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX "Product_name_trgm_idx"       ON "Product" USING gin (name gin_trgm_ops);
CREATE INDEX "Product_partNumber_trgm_idx" ON "Product" USING gin ("partNumber" gin_trgm_ops);
CREATE INDEX "Product_sku_trgm_idx"        ON "Product" USING gin (sku gin_trgm_ops);
CREATE INDEX "Product_brand_trgm_idx"      ON "Product" USING gin (brand gin_trgm_ops);
```

**Applying to production:** `prisma migrate` runs inside a transaction and takes a write lock on the table while an
index builds. On tables of this size the build takes well under a second (300 ms for the 400k-row OrderItem index in
the scratch run), so it is fine off-peak; for much bigger tables create them by hand with
`CREATE INDEX CONCURRENTLY ...` and then record the migration. Every index slightly slows writes to its table and uses
disk, which is why only the ones with a measured plan change are in the table above.

### Foreign keys with no index at all (39 of 98)

Postgres does not index foreign keys automatically. These cause slow joins/lookups and slow parent deletes. Most are
low-volume admin tables; the ones on busy tables are already in the list above. The rest, for completeness:

* Catalog: `ProductVariant(productId)`, `VariantImage(variantId)`, `OrderItem(productId)`, `OrderItem(variantId)`,
  `CartItem(variantId)`, `VehicleAccessory(productId)`, `VehicleProductRecommendation(productId)`,
  `VehicleDiagramHotspot(productId | sectionId | compatibilityId)`, `VehicleDiagram(generationId | sectionId)`,
  `ProductCompatibility(generationId)`, `VehicleVinPattern(vehicleId | variantId | manufacturerId)`,
  `VehicleSpin(variantId | colorId)`, `VehicleDetectionLog(detectedVariantId)`.
  (`VehicleModel3D(variantId | colorId)` is moot: the 3D viewer was removed.)
* Auth: `Account(userId)`, `Session(userId)`, `Review(userId)`.
* CRM / procurement / vendors: `LeadActivity(leadId)`, `LeadNote(leadId)`, `PurchaseOrder(vendorId)`,
  `PurchaseOrderItem(purchaseOrderId)`, `PurchaseRequestItem(purchaseRequestId)`, `GoodsReceivedNote(purchaseOrderId)`,
  `GoodsReceivedItem(goodsReceivedNoteId)`, `VendorContact(vendorId)`, `VendorDocument(vendorId)`,
  `VendorPayment(vendorId | purchaseOrderId)`.

Add these only if `pg_stat_statements` shows them in the top queries; do not add all 39 blindly.

## 5. What an index will NOT fix

* **Q4, search by vehicle compatibility.** `Product.compatibility` is a `text[]` and the query matches `ILIKE` against
  each *element*; no ordinary index supports that. Real options: (a) keep a denormalised search column such as
  `array_to_string(compatibility, ' ')` with a trigram index and query that same expression (a code change), or
  (b) lean on the structured `ProductCompatibility` matrix the search already also queries. It costs ~40 ms at 20k
  products and grows linearly with the catalog, so it is the one to revisit if the catalog gets much larger.
* **Q7, dashboard totals.** `count(*)` of all orders and `sum(amount)` over ~70% of `Payment` rows must read most of the
  table whatever the index. Cheap fixes if it ever matters: cache the dashboard numbers for a minute, or keep a
  running total.
* **Deep `OFFSET` pagination** gets slower the further you page. Page numbers are now capped at 5,000 (see
  `src/lib/query-limits.ts`), but a keyset ("after this id") scheme would be the real fix for huge lists.
