# MOTOXPLUS Marketplace — Phase 0 Audit & Architecture Proposal

**Status:** For approval. No production code, schema or database was touched.
**Date:** 2026-11-05 · **Scope:** the 9 reports requested in §20 of the master prompt.
**Method:** read-only inspection of `prisma/schema.prisma` (1,830 lines, 78 models/enums), `src/app/api` (165 routes),
`src/lib/*`, `backend-java/*`, `nginx.conf`, `.env.example`, `docs/`, `AUDIT/`, `B2C-EXPANSION-PLAN.md`.
I did **not** connect to the live PostgreSQL database; table analysis is from the Prisma schema + migrations.
Anything I could not verify is marked **(unverified)**.

---

## 0. Headline findings — things that change the plan

| # | Finding | Why it matters |
|---|---|---|
| 1 | **"Vendor" already exists and means something different.** `Vendor` = a *procurement supplier* MotoXPlus buys from (categories `RAW_MATERIALS`, `PACKAGING`, `LOGISTICS`…, has `PurchaseOrder`, `GoodsReceivedNote`, `VendorPayment`, `creditDays`). `User.role = VENDOR`, `/vendor/*` portal, `/api/vendor/*`, `Product.vendorId`, `Product.vendorCostPrice` and `ProductSource.VENDOR` all belong to that flow: the vendor supplies goods, MotoXPlus **resells** them at a markup. | A marketplace seller is a different legal/financial actor (sells in their own name, gets paid from the buyer's money). Reusing the `Vendor` table would corrupt procurement. Need a separate seller entity and a naming decision (D1). |
| 2 | **Existing Java backend conflicts with the prompt's stack.** `backend-java/` is Java **17**, Spring Boot **4.1.2** (Hibernate 7), no Flyway, and its README rule is *"Prisma owns the schema; never add migrations here"*. 11 of 165 routes ported. Local machine: JDK 17 only; no `mvn` (wrapper exists), no Docker, no `psql`. | Prompt asks Java 21, Spring Boot 3.x, Flyway, Testcontainers. Must reconcile (D2, D3). |
| 3 | **No BigShip anywhere in the repo** (case-insensitive search: 0 hits). Carriers present: **Delhivery** (B2C + B2B LTL; rates, serviceability, shipment, pickup, tracking, signed webhook) and a **Shiprocket** auth/client stub. | Prompt names BigShip as the initial provider. I have no BigShip credentials/spec in the repo. Decide D5. |
| 4 | **Payments are standard Razorpay only** (`razorpay` SDK, key id/secret, one webhook). No Route, no linked accounts, no transfers. `@cashfreepayments/cashfree-js` is in `package.json` but unused in `src/`. B2C also has COD, and manual UPI/bank-transfer submissions (`PaymentSubmission`). | Split settlement is not available today. Route needs Razorpay-side enablement + per-vendor linked-account KYC **(unverified for this account)**. Plan must work without it (D6). |
| 5 | **Money is `Float` (+ `roundToPaise()`), deliberately and documented as "not changing"** (`B2C-EXPANSION-PLAN.md` §1, §2.6). `Product.price` is `Int` rupees. Prompt rule #6 forbids floating-point money. | Both can be true: legacy tables stay Float; **all new marketplace tables use integer paise / NUMERIC**, converted at the boundary. Needs your explicit sign-off (D4). |
| 6 | **Mobile app is Flutter (Dart)**, `motoxplus_app/`, not React Native/Expo. | API design is unaffected (JSON + JWT); OpenAPI can generate a Dart client. Prompt text should be corrected. |
| 7 | **Invoicing assumes MotoXPlus is the only seller.** `Invoice.orderId` is unique (1:1 with `Order`), one seller state (`NEXT_PUBLIC_COMPANY_GST`) drives the CGST/SGST/IGST split, split B2B/B2C series. | In a marketplace the invoice issuer, GSTIN and place-of-supply depend on the *vendor*. Needs a legal/CA decision before Phase 4 (D7). |
| 8 | **Inventory is not a counted quantity for most products.** `Product.stock` is `@deprecated`; `Product.stockStatus` is a 3-state admin flag; only `ProductVariant.stock` is counted, decremented at order confirmation (`lib/orders/stock.ts`). There is no reservation/expiry concept (`Order.stockReserved` is a boolean meaning "already decremented"). | Marketplace needs real counted inventory with TTL reservations. This is new, not an extension. |
| 9 | **RBAC is role + department string checks, not database-driven permissions** (`src/lib/staff-access.ts`, hard-coded `SECTION_DEPARTMENTS`; `middleware.ts` hard-codes role→portal redirects). `UserRole` enum has no `VENDOR_STAFF`. | DB-driven permission model is new. Existing role strings must keep working. |

---

## 1. Current system architecture

```
                         Cloudflare ──► Nginx (nginx.conf, rate-limit zones, CF real-IP)
                                              │
              ┌───────────────────────────────┼──────────────────────────────┐
              │ /api/auth/{login,refresh,     │ everything else               │
              │  logout,me,sessions},         ▼                               │
              │ /api/health, /api/categories, Next.js 15.5 (App Router, PM2)  │
              │ /api/products/search          ├─ pages (SSR, ~53 read Prisma directly)
              ▼ (only when location added)    ├─ 165 route handlers /api/**
        Spring Boot "motoxplus-api"           ├─ NextAuth v4 cookie session (web)
        127.0.0.1:8080 (Java 17, SB 4.1.2)    ├─ custom JWT HS256 15m/7d (mobile)
              │                               └─ Prisma 6 ─────────────┐
              └──────────────► same PostgreSQL ◄───────────────────────┘
                              same Redis (rate limits)
Flutter app (motoxplus_app) ──► /api/mobile/auth/*, /api/** with Bearer JWT
```

* **Frontend/BFF:** Next.js 15.5, React 18, Tailwind 3, Prisma 6.19, zod 4, `next-auth` 4.
* **Auth:** NextAuth credentials (web cookie) **and** a separate JWT (`jose`, HS256, iss `motoxplus-api`, aud `motoxplus-app`, access 15 min, refresh 7 d, `UserSession` row per refresh token). Java already issues/accepts the same JWT; it does **not** mint the NextAuth cookie, so web login must stay on Node (README "Known gaps").
* **Portals:** `/admin` (ADMIN/SUPER_ADMIN/STAFF by department), `/dealer`, `/account` (B2C CUSTOMER), `/vendor` (procurement supplier), public storefront.
* **Hosting:** Hostinger VPS, Nginx + PM2 (`ecosystem.config.js`), Cloudflare in front, R2 for files, Resend email, MSG91 SMS, WhatsApp templates, FCM device tokens, Redis optional.
* **Java today:** auth (login/refresh/logout/me/sessions), health, categories, product search, platform (JWT, bcrypt, Redis rate-limiter, DB lockout, body-size cap, deny-by-default). Entities map only the columns they use; `ddl-auto=none`; test DB is embedded Postgres loaded from a generated copy of the Prisma schema.

---

## 2. Existing database model analysis

78 declarations. Grouped by what the marketplace must do with them:

| Domain | Models | Marketplace stance |
|---|---|---|
| Identity | `User` (role enum, department, lockout, email/mobile verification), `Admin`, `Dealer`, `Customer`, `OtpCode`, `UserSession`, `LoginHistory`, NextAuth `Account/Session/VerificationToken`, `DeviceToken` | **Reuse as-is.** Marketplace seller login = a `User` (role `VENDOR`/new `VENDOR_STAFF`) linked to a new seller entity. |
| Procurement "Vendor" | `Vendor`, `VendorContact`, `VendorDocument`, `VendorRating`, `VendorPayment`, `PurchaseRequest*`, `PurchaseOrder*`, `GoodsReceived*` | **Do not touch.** Different business concept (finding #1). |
| Catalogue | `Category`, `Product`, `ProductVariant`, `VariantImage`, `ProductImage`, `Review` | **Reuse `Product` as the canonical product identity.** Do not alter its price/stock columns. |
| Vehicle fitment | `VehicleManufacturer`, `Vehicle`, `VehicleGeneration`, `VehicleVariant`, `VehiclePartSection`, `ProductCompatibility` (confidence, source, year range, emission), diagrams/hotspots, VIN patterns, detection log | **Reuse unchanged.** Fitment stays attached to `Product`, never to a vendor offer (prompt §7: "preserve compatibility architecture"; rule 12: never assume compatibility). |
| Orders | `Order` (dealerId XOR customerId, `channel` B2B/B2C, subtotal/gst/grand/shipping, CGST/SGST/IGST, 1:1 `Invoice`/`Shipment`/`OrderCancellation`), `OrderItem`, `OrderEvent`, `OrderCancellation`, `OrderItemCancellation`, `CancellationPolicy` | **Keep untouched** for MotoXPlus-direct orders. Marketplace gets parent/child tables (§6). |
| Payments | `Payment` (Razorpay columns inline, `orderId` FK), `PaymentSubmission` (manual UPI/bank), `Setting` (UPI config) | Reuse the Razorpay account/credentials; **new** provider-agnostic payment + allocation + ledger tables. |
| Shipping | `Shipment` (**`orderId` unique → 1 shipment per order**), `ShipmentTrackingEvent`, `ShippingRate`, `Warehouse`, `PickupRequest` | Need many shipments per marketplace order and per-vendor pickup addresses → new tables; reuse Delhivery client code behind a provider interface. |
| Commercial | `Scheme*`, `DealerDuesEntry`, `Lead*` | B2B/MotoXPlus-only. Scheme benefits and dealer dues **do not apply to vendor items** (scope boundary). |
| Ops | `StorageAuditLog`, `Setting`, `DealerDocument` | Reuse storage/audit patterns for vendor KYC documents. |

**Conventions to follow:** cuid `String` PKs (app-generated in Java via `Cuid.next()`), PascalCase quoted table names, UTC `timestamp` without TZ, enums as Postgres native enums, XOR CHECK constraints (dealer/customer).

**Gaps relevant to the marketplace**
* No seller concept; no per-seller price/stock; `Product.sku` and `partNumber` are globally unique.
* `OrderItem.productId` FK → `Product` only; `Order.dealerId/customerId` only (no vendor).
* No ledger, commission, settlement, refund table (refund state lives on `OrderCancellation.refundStatus`).
* No permission tables; no audit-log table for admin actions (only `StorageAuditLog`, `OrderEvent`).
* `OrderItem` lacks indexes (already noted in `AUDIT/00-map.md`).

---

## 3. Existing API and integration analysis

**165 Node routes:** admin 71, auth 18, upload 8, vendors 7, vendor 6, orders 6, crm 6, procurement 5, payments 5, mobile 5, products 3, health 3, dealer 3, staff 2, shipping 2, webhooks 2, files 2, cart 2, admins 2, vehicles/schemes/dev/contact/categories 1 each. Unversioned (`/api/...`); prompt wants `/api/v1/...` for the new surface.

| Integration | State | Notes |
|---|---|---|
| **Razorpay** | Standard checkout. `create-order`, `verify`, webhook (`payment.captured`, `refund.processed/failed`, HMAC-SHA256 on raw body, timing-safe). Capture finalisation is idempotent via `Order.stockReserved` guard (`lib/payments/finalize.ts`). Partial refunds in cancellation flow. | Good patterns to copy (raw-body signature, idempotent finalise). **No Route/transfers.** |
| **Delhivery** | Most mature integration: B2C (token) + B2B LTL (JWT), serviceability, rate calculator, shipment/manifest, once-per-warehouse-per-day pickup (`PickupRequest` unique key), tracking, cancel, webhook with secret, auto-shipment/auto-pickup flags. Behind a `DelhiveryProvider` interface keyed by `Order.channel`. | Reuse as first `ShippingProvider` adapter. Single origin warehouse assumed (`DELHIVERY_PICKUP_*` env). |
| **BigShip** | **Absent.** | See D5. |
| **Shiprocket** | Token client only; `SHIPROCKET_*` env. | Not a functional integration. |
| **Cashfree** | Dependency declared, unused. | Candidate for removal; do not build on it. |
| **Email/SMS/WhatsApp/Push** | Resend; MSG91 provider abstraction (`lib/sms`); WhatsApp order templates with at-most-once claim flags; FCM tokens. | Reuse for vendor OTP/notifications. |
| **GST/PAN verification** | Admin toggles only (`gstVerified`), config gate `verification_gst_required`. No external API. B2C plan D2 intends gst.gov.in/GSP; **Aadhaar must never be stored** (yet `Vendor.aadhaarNumber` and dealer forms currently collect it encrypted). | Prompt wants verification *interfaces*: build as ports with stub + pluggable provider. |
| **Storage** | Cloudflare R2 (S3 SDK), signed URLs, `StorageAuditLog`. | Reuse for private vendor KYC docs (signed, short-lived, private bucket/prefix). |
| **Encryption** | AES-256-GCM `ENCRYPTION_KEY` (`lib/crypto/encryption.ts`), format `iv.tag.cipher` base64. | Java must implement the identical format to read/write interchangeably, or use a new key + versioned envelope for vendor bank data. |
| **Rate limiting** | Redis, shared keyspace between Node and Java. | Reuse `RateLimitEnforcer`. |

**Order creation today** (`/api/orders`): server-side price resolution (good), placeholder shipping (5% / free ≥ ₹25k), GST per line, scheme + dues handling, three separate invoice-creation sites. This logic is **too entangled with dealers/schemes/dues to generalise**; the marketplace checkout should be new code that calls shared tax/pricing primitives.

---

## 4. Reusable components

| Reuse | From | Into |
|---|---|---|
| JWT issue/verify, sessions, lockout, bcrypt, rate limiter, error envelope `{error, code, retryAfterSeconds}` | `backend-java` (done) | All new marketplace endpoints |
| OTP + email/mobile verification flow | Node `/api/auth/*`, `lib/auth/otp*` | Vendor registration (Java port or call Node) |
| Server-side price resolution + channel concept (`channelForRole`) | `lib/pricing/*` | Buyer-type pricing on `SellerOffer` |
| GST split (CGST/SGST/IGST), state codes | `lib/tax/*` | Per-vendor-order tax (seller state = vendor warehouse state) |
| Delhivery client (rates, serviceability, shipment, pickup, tracking, webhook) | `lib/delhivery/*` | First `ShippingProvider` adapter |
| Razorpay client, webhook signature pattern, idempotent finalise | `lib/razorpay.ts`, `lib/payments/finalize.ts` | `PaymentProvider` adapter |
| Order cancellation policy + refund calc | `lib/orders/cancellation*.ts`, `CancellationPolicy` | Reference for marketplace cancellation rules (do not call directly) |
| Vehicle compatibility queries | `lib/vehicle/compatibility.ts`, `ProductCompatibility` | Offer listing pages, vendor product fitment picker |
| R2 upload/validate/signed URL/audit | `lib/storage/*` | Vendor documents + product images |
| WhatsApp/email notification patterns | `lib/whatsapp`, Resend | Vendor/buyer notifications |
| `Cuid.next()`, `Time.utcNow()`, `PhoneUtil` | `backend-java/common` | All new entities |

---

## 5. Missing marketplace components

Seller entity & KYC lifecycle · seller bank accounts (encrypted) · verification ports (GSTIN/PAN/bank/penny-drop) · seller agreement versioning · permissions tables + `VENDOR_STAFF` · `SellerOffer` + counted `Inventory` + `InventoryMovement` + reservations with TTL · listing moderation + duplicate-product request flow · `MarketplaceOrder` parent / `VendorOrder` child / status machines · multi-shipment + multi-pickup orchestration · payment provider abstraction + `PaymentAllocation` · commission rule engine (global/vendor/category/product/B2B/B2C/promo, effective-dated) · immutable double-entry ledger · settlement + provider-confirmed payout · refunds/returns/disputes · reconciliation · generic audit log · idempotency-key store · vendor/platform analytics · `/api/v1` OpenAPI contract · vendor-level invoicing (D7).

---

## 6. Proposed Java backend architecture

**Single deployable, modular monolith, extending the existing `backend-java` app** (same JVM, same JWT/rate-limit/error platform) — not a second service.

```
com.motoxplus.api
 ├─ platform/      (existing: security, jwt, ratelimit, web errors, common)
 ├─ iam/           permissions, roles→permissions, VENDOR_STAFF, ownership guard
 ├─ vendor/        onboarding, KYC, documents, bank, agreements, status machine, vendor staff
 ├─ catalog/       (existing) + listings, offers, moderation, duplicate requests
 ├─ inventory/     stock, reservations (TTL), movements
 ├─ pricing/       buyer-type resolution on offers (server-side only)
 ├─ checkout/      cart, checkout, idempotency
 ├─ order/         MarketplaceOrder, VendorOrder, OrderItem, state machines, returns
 ├─ shipping/      ShippingProvider port, DelhiveryAdapter, (BigShipAdapter), orchestration, webhooks
 ├─ payment/       PaymentProvider port, RazorpayAdapter, (RazorpayRouteAdapter), allocation, webhooks
 ├─ finance/       commission, ledger, settlement, refund, reconciliation
 ├─ admin/         moderation + ops facades (no business logic of its own)
 ├─ analytics/     read-side queries/materialised views
 └─ audit/         audit log + @Audited aspect
```

Rules: modules talk through services/interfaces and **domain events** (Spring `ApplicationEventPublisher` + transactional outbox table for anything that must not be lost: payment captured, shipment event, settlement). No module reads another module's tables directly. Package-boundary tests (ArchUnit) enforce it.

**Frontend coexistence:** Next.js stays the only UI. New surface is `/api/v1/**` served by Java (Nginx `location /api/v1/ { proxy_pass 127.0.0.1:8080; }`). Existing `/api/**` routes are unchanged. Vendor Portal pages are new Next.js pages calling `/api/v1`. Web auth: Java accepts Bearer JWT (already works); the Next.js pages obtain a JWT via the existing mobile-style login or a thin Node route that mints one for the NextAuth session (open item D8).

**Stack decision points:** see D2/D3.

### Proposed data model (all new, in a dedicated Postgres schema `marketplace`)

```
public."User" 1─1 marketplace.vendor 1─* vendor_document / vendor_address / vendor_bank_account / vendor_agreement_acceptance / vendor_status_history
                      │                 1─* vendor_staff(user_id, vendor_id, role)
                      │
public."Product" 1─* marketplace.vendor_product(vendor_id, product_id, vendor_sku, listing_status)  ── 1─* seller_offer ── 1─1 inventory ── *─ inventory_movement
        │  (MotoXPlus is a vendor row with type=PLATFORM; its offers are backfilled from Product.price/mrp/moq)
        └─ ProductCompatibility (unchanged)

marketplace_order 1─* vendor_order 1─* order_item(offer_id, product_id, unit_price_paise, tax…)
                  │                 └─* shipment 1─* shipment_tracking_event
                  └─* payment 1─* payment_allocation(vendor_order_id, gross, commission, tax, net)
ledger_account / ledger_entry (append-only, double-entry, DB triggers forbid UPDATE/DELETE)
commission_rule(scope, scope_id, buyer_type, rate_bp, valid_from, valid_to, priority) ─ commission(vendor_order_item_id, rule_id, amount)
settlement 1─* settlement_transaction(provider_ref, provider_status) ; refund ; return_request ; reconciliation_record
permission / role_permission / user_permission_override ; audit_log ; idempotency_key ; outbox_event
```

Key design choices
* **`Product` stays the identity; offers sit beside it.** MotoXPlus's own sale = an offer by the `PLATFORM` vendor. Backfill is additive; until cutover, `Product.price/mrp/moq/stockStatus` remain the source of truth for MotoXPlus and a sync job/trigger projects them to its offer (avoids dual-write drift).
* **Never auto-merge by name.** A vendor either (a) attaches an offer to an existing `Product` found by exact OEM/part-number/SKU and confirmed by moderator, or (b) raises a *new-product request* (moderated; duplicate suggestions shown, human decides). Compatibility is edited only on `Product` by moderators.
* **Money:** `BIGINT` paise for ledger/orders/commission/settlement; `NUMERIC(12,2)` or paise for offer prices; GST rates `NUMERIC(5,2)`; commission as basis points. No `double` anywhere in `marketplace.*`.
* **State machines** (`MarketplaceOrder`, `VendorOrder`, `Vendor`, listing, settlement) as explicit transition tables in code + DB CHECK on allowed values; every transition writes an event row.
* **Concurrency:** `inventory` row uses guarded `UPDATE … SET reserved = reserved + :q WHERE available - reserved >= :q` (same idea as today's `stock: { gte }`) plus `@Version`; reservation rows carry `expires_at` and a scheduled job releases them (`SKIP LOCKED`).
* **Idempotency:** `idempotency_key(scope, key, request_hash, response)` for checkout/payment; unique `(provider, provider_event_id)` for webhooks.

---

## 7. Database migration strategy

1. **Ownership split.** Prisma continues to own schema `public` (unchanged). **Flyway owns a new schema `marketplace`** with its own history table (`marketplace.flyway_schema_history`). `ddl-auto=none` stays. Rationale: satisfies "Flyway" without two tools fighting over the same tables.
2. **Verify the Prisma risk first:** `package.json` has `db:push`. Prisma only diffs schemas it knows (`public`), so it should ignore `marketplace` — but FKs from `marketplace.*` into `public."Product"`/`"User"` mean `prisma db push --accept-data-loss` / `migrate reset` could fail or cascade. Mitigation: ban `db push`/`migrate reset` against any shared DB, add a CI check, document in `OPERATIONS.md`. **(to be tested on a scratch DB in Phase 1, not production)**
3. **Additive only.** New schema + new tables. The only change to `public.*` that I foresee is **adding `VENDOR_STAFF` to `UserRole`** (additive enum value; Prisma migration) and possibly a nullable `legacy_order_id`-style link **from** `marketplace` **to** `public."Order"` (FK lives on the new side). No columns dropped, nothing renamed, no data rewritten.
4. **Backfill (idempotent, re-runnable, dry-run first):** create `PLATFORM` vendor row; create `vendor_product`/`seller_offer`/`inventory` for each active `Product`/`ProductVariant`. Never executed automatically — a manual Flyway `R__`/Java migration gated by a flag.
5. **Environments:** local/dev DB restored from a *copy* of production dump (`E:\motoxplus\motoxplus-production.dump` exists) → run Prisma `migrate deploy` then Flyway → run test suite → only then staging → production. Backup immediately before (existing `scripts/db/backup.sh`, `BACKUP.md`).
6. **Rollback:** Flyway migrations are forward-only; each phase ships with a documented `DROP SCHEMA marketplace` rollback that is safe *only before* real data exists, and a feature flag (`MARKETPLACE_ENABLED`) so the Java endpoints and Next.js pages can be disabled without touching the DB.
7. **Test DB:** replace the "generated Prisma SQL" approach with Testcontainers PostgreSQL (needs Docker on the dev machine / CI — not installed locally today; fallback is the existing embedded-postgres).

---

## 8. Security and financial risks

**Security**
| Risk | Severity | Mitigation |
|---|---|---|
| **Tenant isolation** — one vendor reading another's orders/settlements | Critical | Every vendor-scoped query takes `vendor_id` from the JWT/`vendor_staff` membership, never from the request; repository methods without a vendor param are not exposed to vendor controllers; integration tests assert 404 (not 403) on cross-vendor IDs; consider Postgres RLS as defence in depth. |
| Two session systems (NextAuth cookie + JWT) | High | Vendor APIs accept Bearer JWT only; CSRF not applicable; short access TTL retained; verify `UserSession` row on refresh (already done). |
| Shared `JWT_SECRET` between Node and Java | Medium | Keep, but rotate per `SECRET-ROTATION.md`; ensure Java refuses boot without it (already true). |
| KYC docs & bank accounts | High | Private R2 prefix, signed URLs ≤ 5 min, AES-256-GCM envelope with versioned key id, mask in API responses, decrypt only in the payout path, audit every read. Existing Aadhaar collection should not be extended to marketplace vendors. |
| Webhook forgery/replay | High | Raw-body HMAC (copy Razorpay approach), timestamp tolerance, `(provider, event_id)` unique, constant-time compare. Note: Delhivery webhook currently authenticates by shared secret in a query param — weaker; fine to keep for legacy, not for new. |
| Client-trusted values | High | Price, commission, shipping, tax and payment status are computed/confirmed server-side only (prompt rules 7–9). |
| Rate limiting / enumeration on vendor register + OTP | Medium | Reuse `RateLimitBudgets` classes. |
| File upload abuse | Medium | Reuse `lib/storage/validate` rules (type sniffing, size cap), virus scan hook (optional). |
| Secrets hygiene | Medium | `.env*`, dumps and `railway_backup.sql` are **not tracked** in git (verified), but exist on disk in the repo folder and `production.env` sits in the parent folder; keep out of any Docker build context (`.dockerignore`). |
| Working tree | Info | 59 modified/untracked files exist uncommitted (incl. Java work in progress). Marketplace work should branch from a committed baseline. |

**Financial**
| Risk | Mitigation |
|---|---|
| Float money in legacy tables leaking into new maths | Convert at one boundary function (`Money.fromRupeesFloat` rounding half-up to paise); never store converted values back as float. |
| Double-spend of stock under concurrent checkout | Guarded atomic update + TTL reservation + concurrency test (Phase 8) |
| Double payout / paying before provider confirms | Settlement state machine: `APPROVED → TRANSFER_INITIATED → CONFIRMED(provider webhook/status poll)`; no endpoint can set `CONFIRMED` directly; idempotent provider reference. |
| Ledger tampering | Append-only entries, DB trigger rejecting UPDATE/DELETE, corrections via reversing entries, balanced-transaction CHECK (sum debit = sum credit per `txn_id`) enforced in a deferred constraint trigger. |
| Commission changes affecting past orders | Rules are effective-dated; commission amount + rule snapshot stored on the order line at checkout. |
| Refund after settlement | Hold window (`delivered_at + return_window + dispute hold`) before settlement eligibility; negative balance / clawback path via ledger. |
| Tax/regulatory (**needs CA/counsel, not engineering**) | Who issues the invoice (vendor vs MotoXPlus as e-commerce operator), TCS under GST, TDS on vendor payouts, GST registration of operator, Consumer Protection (E-Commerce) Rules 2020 seller-disclosure duties, RBI payment-aggregator rules if MotoXPlus holds buyer funds and pays vendors **without** Route/PA licence. I'm flagging these, not asserting current rates or rules. |
| Payment-aggregator exposure | If funds are collected in MotoXPlus's own Razorpay account and re-paid to vendors, that may constitute payment-aggregation activity. This is the strongest argument for Razorpay Route (or another licensed split product). Needs written confirmation from Razorpay/counsel. |

---

## 9. Development phases and dependencies

```
P0 audit ──► [YOU: approve D1–D9] ──► P1 Foundation ──► P2 Vendor mgmt ──► P3 Product & inventory ──► P4 Buying
                                          │                                                              │
                                          └─ (RBAC, Flyway, audit, idempotency, OpenAPI)                 ├──► P5 Shipping ─┐
                                                                                                         └──► P6 Payments ─┴─► P7 Admin/analytics ─► P8 Hardening
```

| Phase | Depends on | Blocking external inputs |
|---|---|---|
| P1 | D1–D4 | JDK 21 install, Docker (for Testcontainers) or accept embedded-postgres |
| P2 | P1 | GSTIN/PAN/bank-verification vendor (or stub); seller agreement text (legal) |
| P3 | P2 | Business rules for duplicate handling; MotoXPlus offer backfill sign-off |
| P4 | P3, D7 | CA decision on invoicing/TCS; B2C pricing rules per offer |
| P5 | P4 (needs VendorOrder) | D5 carrier + sandbox credentials; vendor pickup-location registration process with carrier |
| P6 | P4 | **D6**: Razorpay Route enablement answer; CA/counsel on TCS/TDS/PA |
| P7 | P2–P6 | — |
| P8 | all | Staging VPS, sandbox keys |

P5 and P6 can run in parallel after P4. P4 can ship to production only after P5 *and* P6 minimums exist (a marketplace order you can't ship or pay out is not launchable); until then everything stays behind `MARKETPLACE_ENABLED=false`.

---

## 10. Decisions I need from you (answer before Phase 1)

| ID | Decision | My recommendation |
|---|---|---|
| **D1** | Naming/entity for external sellers, given `Vendor` already = procurement supplier. | New table `marketplace.vendor` (API/UI say "vendor" as in your prompt), old one renamed in conversation/docs to "Supplier". Role `VENDOR` is currently the *supplier* login → add **`SELLER`** role? Or reuse `VENDOR` and distinguish by which profile row exists? I recommend **new roles `SELLER` and `SELLER_STAFF`** (prompt's `VENDOR_STAFF` maps to `SELLER_STAFF`) so `middleware.ts`'s `/vendor` redirect for suppliers is untouched. |
| **D2** | Java/Spring version. Prompt: Java 21 + Boot 3.x. Repo: Java 17 + Boot 4.1.2. | **Keep Boot 4.1.x** (don't downgrade working code; Boot 3.x is the older line) and move to **Java 21** (needs JDK 21 locally; VPS Ubuntu 24.04 supports it). If you require 3.x literally, say so and I'll flag the downgrade cost. |
| **D3** | Flyway vs "Prisma owns schema". | Flyway owns schema `marketplace` only; Prisma owns `public` (§7). |
| **D4** | Money type. | Integer **paise** (BIGINT) in all new tables; legacy Float untouched. |
| **D5** | Initial shipping carrier. BigShip isn't in the repo. | Build the `ShippingProvider` port + **Delhivery adapter first** (code and credentials exist), BigShip adapter when you provide API docs/sandbox credentials. |
| **D6** | Payment model: (a) Razorpay Route linked accounts, (b) collect-all in MotoXPlus account + own payouts, (c) defer vendor payouts to manual bank transfer recorded in ledger (provider-confirmed via bank statement import). | Ask Razorpay in writing whether Route is enabled for this account. Plan **(a)** as target, build the ledger so **(b)/(c)** also work; **(c)** only as an interim and with counsel's OK. |
| **D7** | Invoicing: vendor issues invoice (needs vendor-level series + GST data) vs MotoXPlus issues on vendor's behalf. | CA decision. Engineering default: invoice is generated per `VendorOrder` with vendor GSTIN/state, MotoXPlus commission invoiced separately to the vendor. |
| **D8** | How Next.js vendor pages authenticate to Java: (a) JWT from existing login, held in httpOnly cookie, (b) tiny Node route that exchanges NextAuth session → JWT. | (b) for web (no logout of existing users), (a) for Flutter (already works). |
| **D9** | Launch scope: B2C + B2B both at first release, or B2B (dealers) first? | B2B dealer pricing first; B2C offers behind the existing channel seam once Phase 6 is proven. |

---

## 11. What happens after approval

Phase 1 deliverable (per prompt): Maven module/packages above, JDK 21 + Flyway wiring for schema `marketplace`, permission tables + `SELLER`/`SELLER_STAFF`, audit log, idempotency store, `/api/v1` + OpenAPI, Testcontainers/embedded test base, tests and results, env vars, deploy notes, known limitations. I will not touch `public.*` or any real database until you approve D1–D4 and tell me which database (a restored copy of `motoxplus-production.dump` locally is my suggestion).

*Not verified in this audit:* live DB contents/row counts; Razorpay account capabilities; whether production Nginx currently proxies anything to the Java app; contents of the `AUDIT/*.md` reports beyond what `B2C-EXPANSION-PLAN.md` quotes; the 44 Node test files' coverage.
