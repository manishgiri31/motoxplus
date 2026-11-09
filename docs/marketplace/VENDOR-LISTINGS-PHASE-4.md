# Vendor listings — Phase 4 (create, edit, publish, unpublish)

**Status:** implemented and tested locally (embedded PostgreSQL + in-memory R2). Nothing committed or deployed; nothing written to
any real database or bucket (the dev database was only read). Not yet viewed in a browser.

## Decisions applied
| Topic | Rule |
|---|---|
| Pricing | The vendor sets MRP, retail and dealer price. MRP ≥ retail ≥ dealer, all > 0, whole rupees. Checked in Java, in the database (CHECK constraints) and in the editor. |
| Publishing | No review queue. A listing from an approved vendor that passes the publish rules goes live at once. Every create, edit, publish, unpublish and photo change is in `marketplace.audit_log`. |
| Commission | 15% of the sale, taken only once the order is delivered end to end and paid. Stored as configuration in `marketplace.commission_rate` (effective-dated, append-only; see "Commission rules"). Shown to the vendor as a payout estimate; nothing charges it yet. |
| Returns | The vendor pays nothing. MotoXPlus keeps 20% of a returned order and refunds the rest to the customer; Delhivery's return charges come out of that 20%. Configuration only. (The earlier 5% vendor return fee is removed.) |
| Out of scope | Orders, payments, GST invoicing, shipping, settlement and payouts (Phases 6–7). |

## The journey
`/vendor/listings` (tabs: all / live / drafts / unpublished, search) → **New listing** → `/vendor/listings/new` (details, prices,
stock, fitment, tax) → **Save draft** → `/vendor/listings/[id]#photos` (add up to 8 photos) → **Publish**. The side panel lists what is
still missing; each item jumps to its field. A live listing can be edited (changes are live on save) or unpublished.

## Database (`V4__vendor_listings.sql`, additive)
- `marketplace.vendor_listing`: identity, three prices (paise), stock, MOQ, HSN, GST rate, weight, status `DRAFT | LIVE | UNPUBLISHED`,
  `product_id` (set on first publish). `UNIQUE (vendor_id, sku)`. A CHECK makes an incomplete `LIVE` row impossible.
- `marketplace.vendor_listing_image`: private-bucket key, sniffed MIME type, size ≤ 5 MB, sha256, order (0 = primary).
- `marketplace.vendor_listing_fitment`: vehicle + optional year range.
- `marketplace.commission_rate`: the commission rules below, seeded as `commission-launch`.
- Indexes: only those on the new tables (PKs/uniques, `vendor_listing (vendor_id, updated_at)`, `vendor_listing_image (listing_id, sort_order)`).
  **No index or full-text change on any existing table.**

## Commission rules (configuration only)
Read with `CommissionRates.current()`. Nothing in this phase takes, holds, refunds or pays out money; settlement (Phases 6–7) must
apply these rules. A change is a new row with a later `effective_from` (past rows can't be edited). Percentages are basis points.

| Rule | Configured as |
|---|---|
| Sale commission is 15% of the sale | `sale_commission_bp = 1500` |
| Taken only once the order is delivered end to end and the customer's payment is complete; nothing on a cancellation | `settles_on = 'DELIVERED_AND_PAID'` |
| 100% prepaid: after delivery 15% is deducted, the rest goes to the vendor | `sale_commission_bp`, `settles_on` |
| 20% advance + COD: the advance shows in the vendor's virtual balance, locked until delivered and paid | `cod_advance_bp = 2000`, `settles_on` |
| COD completed: vendor 85%, MotoXPlus 15% | `sale_commission_bp` |
| COD order cancelled: the advance goes straight to MotoXPlus | `cod_advance_on_cancel = 'TO_MOTOXPLUS'` |
| Return (prepaid or advance + COD): MotoXPlus keeps 20%, the rest goes back to the customer; the vendor pays nothing | `return_deduction_bp = 2000` (taken from the customer's refund, never the vendor) |
| Delhivery's return charges come out of the 20% MotoXPlus keeps | `return_shipping_paid_from = 'RETURN_DEDUCTION'` |

The text columns accept only the behaviour above; add a value together with the settlement code that handles it.

Still to settle before Phase 6–7 builds this: whether the percentages apply to the GST-inclusive order value and include delivery
fees; what a COD order refused at the door (return to origin) counts as; whether a prepaid cancellation is refunded in full; and what
happens when Delhivery's return charge is more than the 20%.

## How listings reach search (no search change)
Publishing projects the listing onto one `public."Product"` row (`source = 'VENDOR'`, `vendorId`), which the existing `/api/search`,
product page and catalogue already read. Mapping: dealer price → `price`; MRP → `mrp`; SKU → `"<vendorCode>-<sku>"`; part number as
entered, or suffixed with the vendor code if another product already uses it; photos → `ProductImage.imageUrl =
/api/v1/listing-images/{id}`; fitment → `ProductCompatibility` rows `UNVERIFIED / IMPORTED` (never `Product.compatibility`, which the
product page prints as confirmed). Unpublish sets `isActive = false`. Suspending or blocking a vendor hides their live listings;
reactivating restores them (`ProductProjection.syncVendor`, called from the review service's status transition).

## Photos
Private bucket, key `vendors/{vendorId}/listings/{listingId}/{uuid}.{ext}`. Type decided by the bytes (JPG/PNG/WEBP), max 5 MB, max 8.
Java streams them (same origin, so the existing CSP and `next.config.mjs` need no change):
- `GET /api/v1/vendors/me/listings/{id}/images/{imageId}` owner only, any status, `private, max-age=300`;
- `GET /api/v1/listing-images/{imageId}` public, only while the listing is live and the vendor approved, `public, max-age=300`.

## API (`/api/v1`, session cookie or Bearer; vendor = login, never the request)
| Method | Path | |
|---|---|---|
| GET | `/vendors/me/listings/overview` | counts, allowed categories, commission bp, GST rates, limits |
| GET | `/vendors/me/listings?status=&q=&page=&size=` | page of summaries (with publish checklist) |
| POST | `/vendors/me/listings` | create draft → 201 |
| GET / PUT | `/vendors/me/listings/{id}` | read / save (a live listing must stay complete) |
| POST | `/vendors/me/listings/{id}/publish` | 400 `LISTING_INCOMPLETE` + `fieldErrors` if not ready |
| POST | `/vendors/me/listings/{id}/unpublish` | 409 `NOT_LIVE` if not live |
| POST / DELETE | `/vendors/me/listings/{id}/images[/{imageId}]` | multipart `file` / remove (409 `LAST_PHOTO` on a live listing) |
| POST | `/vendors/me/listings/{id}/images/{imageId}/primary` | |
| GET | `/vendors/me/listings/vehicles?q=` | fitment typeahead |

Access is Phase 2's rule for selling features: `VendorContext.active()` (role `VENDOR`, account `APPROVED`, email and mobile verified)
plus the `vendor.product.view/create/update` permission. Every query filters on the caller's vendor id, so another vendor's listing
answers 404.

Publish rules: title, category (one of the vendor's approved categories), brand, part number, SKU, ≥ 1 photo, three prices, stock ≥ 1
and ≥ MOQ, HSN code. Error messages are identical in `ListingRules.java` and `src/lib/vendor/listings.ts`.

## Also changed
- `BodySizeFilter`: multipart uploads to `/api/v1/vendors/me/application/documents` and `/api/v1/vendors/me/listings/{id}/images` get a
  6 MB cap instead of 16 KB. **This also fixes Phase 2 KYC uploads**, which a real browser (it sends `Content-Length`) would have had
  refused with 413; MockMvc sends no length, so the tests never saw it. `BrowserUploadIntegrationTest` now sends both uploads to a
  running server the way a browser does (multipart with `Content-Length`, `mx_access` cookie).
- `.gitignore`: `*.sql` had hidden every Flyway migration (V1–V4) and the Java test schema from git. Two exceptions now track
  `backend-java/src/main/resources/db/migration/*.sql` and `backend-java/src/test/resources/**/*.sql`.
- Vendor sidebar: "My Products" → "Listings".

## Tests
- Java: `ListingRulesTest` (8), `ImageTypesTest` (3), `BodySizeFilterTest` (2), `VendorListingIntegrationTest` (13: ownership from the
  login, cross-vendor 404s, approved-only access, price ordering in code and DB, category/SKU/vehicle checks, publish refused until
  complete, publish-on-valid + search + public photo, unpublish/re-publish, live edits, part-number clash, photo validation and private
  storage, suspend/reactivate, commission rules as configuration), `BrowserUploadIntegrationTest` (3: a listing photo and a KYC
  document over 16 KB sent to a running server the way a browser sends them, plus the control that the same body still gets 413 on a
  JSON endpoint). `BaselineMigrationTest` counts updated for V4. Full suite **172/172 on JDK 21**.
- Node: `src/lib/vendor/listings.test.ts` (14). Full suite **598/598**.

## To go live
1. Apply V4 with the takeover procedure (`DB_MIGRATE=true` once), with V2 and V3 already applied.
2. Java with `MARKETPLACE_ENABLED=true` and the private bucket configured.
3. Deploy Next only after 1–2: the sidebar now points at `/vendor/listings`, which needs the Java endpoints.

## Known limits and follow-ups
- **Open decision for go-live: a live listing can be ordered through today's B2B checkout** at the dealer price, as admin-approved
  vendor products already can. That flow invoices as MotoXPlus and takes no commission. The checkout is deliberately unchanged;
  decide before go-live whether to block vendor products from it until marketplace orders exist (Phase 6).
- The local dev database has no Flyway history (no V1–V4, no `marketplace` schema; checked 2026-11-07). Search works in `next dev`,
  but the vendor listing and onboarding pages need the takeover migration run there, then Java with `MARKETPLACE_ENABLED=true`.
- The retail price lives only on the listing; today's B2C pricing reads `Product.mrp`.
- Stock is what the vendor declares; nothing decrements it until orders exist.
- Vehicle names are not part of the search text (fitment is in `ProductCompatibility`, not `Product.compatibility`), so "splendor brake
  pad" finds a vendor listing only if the title names the model. Changing that means changing search.
- No variants: one SKU per listing.
- Old `/vendor/products` pages and `POST /api/vendor/products` (Node, cost price + MotoXPlus markup + admin review) still exist, unlinked.
  Retire them once listings are live.
- Admin view of listings (moderation, takedown) is not built; admins can still deactivate the product row.
