# Vendor onboarding, activation & seller dashboard — Phase 0 audit

**Date:** 2026-11-06 · **Status:** for decision. Read-only audit; no code, schema or data changed for this report.
**Builds on:** `PHASE-0-AUDIT.md` (marketplace backend, 2026-11-05), `FRONTEND-PHASE-0-AUDIT.md`, `PHASE-1.md`,
`DB-TAKEOVER.md`, `SELLER-REGISTRATION-API.md`. Where this report and those disagree, this one says so explicitly.

---

## Decisions (answered by the owner, 2026-11-06). These override the tables below where they differ.

| ID | Answer | What changes |
|---|---|---|
| **V1** | *"There's no different supplier, just vendors who supply us different products."* There is **one** vendor concept. | Reuse `public."Vendor"`, the `VENDOR` role and `/vendor/*`; extend them, do not create a separate seller entity. **This supersedes D1/F2** of the earlier audits (`SELLER`/`SELLER_STAFF`, `/seller/*`): the `marketplace.role_permission` seeds must grant the marketplace permissions to `VENDOR`. Purchase orders stay a feature of the same vendor. Routes in §12a use `/vendor/*`; new tables in §9 hang off `public."Vendor".id` (e.g. `vendor_listing`, `vendor_status_history`) instead of a new `seller` table. |
| **V2** | **Manual approval only.** | No automatic activation. Every check that can run automatically still runs and is recorded (OTP, completeness, PAN/GSTIN format + match, duplicates, documents present), then the application moves to `UNDER_REVIEW`; an admin approves (→ `ACTIVE`), rejects or holds it. No KYC provider integration. Brief §5's auto-activation is out of scope. |
| **V3** | **Port shared services to Java first.** | Phase 1b (email, SMS, OTP, storage in Java) comes before any vendor onboarding code. No new Node API routes. |
| V4, V5 | Not asked; recommendations applied. | Apple-style site tokens with a restrained red accent; three prices on the vendor listing. |

---

## 0. Five findings that decide the plan

| # | Finding | Consequence |
|---|---|---|
| 1 | **`Vendor` today is a procurement supplier, not a marketplace seller.** `public."Vendor"` has `PurchaseOrder`, `GoodsReceivedNote`, `VendorPayment`, `creditDays`; `/vendor/*` is the supplier portal (Purchase Orders, Invoices, Payments); `Product.vendorCostPrice` + admin markup means MotoXPlus **resells** supplier goods. The 2026-11-05 audit (D1/F2) therefore planned a separate seller entity, roles `SELLER`/`SELLER_STAFF`, and a `/seller/*` namespace. | Your new brief wants marketplace sellers at `/vendor/dashboard`. Both cannot live at `/vendor` on the `VENDOR` role. **Decision V1.** |
| 2 | **Nothing can verify PAN, GSTIN or a bank account automatically.** GST "verification" is an admin checkbox (`/api/admin/dealers/[id]/gst-verify` sets `gstVerified`). No PAN, GSTIN-lookup, penny-drop or document-OCR provider is integrated. | Activation conditions 6 and 7 ("document verification passed", "bank verified") **cannot be met automatically today**. Without a provider, auto-activation would mean activating on format checks alone, which your brief forbids. **Decision V2.** |
| 3 | **The dealer flow you want copied lives entirely in Node/NextAuth; Java has none of it.** Registration, email OTP, mobile OTP (MSG91), Resend email, R2 uploads, document records and web login are Next.js routes. Java has login/refresh/logout/me/sessions, categories, search, part-categories and the marketplace foundation (RBAC, audit, idempotency, outbox), but no registration, OTP, email, SMS or storage. Your standing rule is *one Java backend, no new Node API routes*. | "Reuse the dealer flow" and "Java only" pull in opposite directions. Either the shared registration/OTP/email/storage services are ported to Java first (dealers can then move too), or vendor onboarding is temporarily built on Node. **Decision V3.** |
| 4 | **KYC documents are not private.** `uploadFile(..., isPrivate=true)` only sets `Cache-Control: private`; the object goes to the **public** bucket and the stored `fileUrl` is a public `r2.dev` URL (`lib/storage/upload.ts`). Applies to existing dealer documents today. | Must be fixed before collecting vendor PAN/bank proofs: separate private bucket (or non-public prefix behind a Worker), store keys only, serve via short-lived signed URLs. Security fix, independent of the decisions. |
| 5 | **The admin bulk importer would let a vendor overwrite MotoXPlus products.** `lib/product-import.ts` upserts by **global** `Product.sku` and replaces images on match; it is synchronous, XLSX-only, 5 MB, image-URLs-only, and uses `xlsx@0.18.5` (the unmaintained npm SheetJS build with published advisories). | Reuse its validation rules and template, not its write path. Vendor import must be scoped by `vendorId`, keyed on `(vendorId, vendorSku)`, asynchronous, and file-image aware. |

---

## 1. Dealer registration & authentication flow (the reference)

```
/become-dealer (landing + DealerRegistrationForm)  or  /register (RegisterForm)
  → POST /api/dealer/register            zod; IP rate limit 5/min; mobile normalised; email/mobile/GST uniqueness;
                                         bcrypt(12); User{role:DEALER} + Dealer{status:ACTIVE}; Aadhaar AES-GCM encrypted;
                                         email OTP created and sent (Resend) + welcome email
  → /verify-email?userId=…  → POST /api/auth/verify-email
  → /verify-mobile          → POST /api/auth/send-mobile-otp, /api/auth/verify-mobile   (MSG91 via lib/sms, lib/auth/otp*)
  → login (NextAuth credentials, src/lib/auth.ts; JWT for mobile/Java)
  → middleware.ts: unverified email → /verify-email, unverified mobile → /verify-mobile,
                   dealer SUSPENDED/REJECTED → /pending-approval, otherwise /dealer/*
  → /dealer/documents (optional uploads, POST /api/upload/dealer-document, one doc per type, upsert)
  → admin: /admin/dealers/[id] status actions, manual GST toggle, request-documents email
```

**What "activation" means for dealers today:** there is no approval step. A dealer is `ACTIVE` from creation; page access is gated by
email + mobile verification; money-moving APIs call `getVerifiedDealer()` (`lib/auth/verified-account.ts`: `isActive`, `emailVerified`,
`mobileVerified`, `status === ACTIVE`). Documents and GST verification do **not** gate anything.

**Reusable as-is:** password policy (`lib/auth/password-policy.ts`), OTP generation/delivery (`lib/auth/otp.ts`, `otp-delivery.ts`),
verify-email / verify-mobile pages and APIs (role-agnostic), mobile normalisation (`lib/phone.ts`), AES-GCM encryption
(`lib/crypto/encryption.ts`), rate-limit budgets, NextAuth session + middleware gating pattern, `getVerified*` guard pattern.

## 2. Vendor registration implementation (what exists)

| Surface | What it is | State |
|---|---|---|
| `/become-vendor` | Marketplace seller landing (hero, benefits, how-it-works, FAQ, red/black "mx-seller" theme). Register section shows `SellerInterestForm` (emails the team via `/api/contact`) because `NEXT_PUBLIC_SELLER_SIGNUP_OPEN` is unset; the 5-step `VendorRegistrationWizard` posts to Java `POST /api/v1/vendors/register`, **which does not exist**. | The brief's description ("procurement supplier form") does not match this page; the procurement form is on `/become-supplier`. |
| `/become-supplier` | Procurement supplier application (`VendorRegistrationForm` → Node `POST /api/vendor/register`): User{role:VENDOR} + Vendor{status:PENDING}, part categories + vehicle segments, email OTP. | Working. |
| `/vendor/*` | Supplier portal: dashboard, products (submit for MotoXPlus to resell, `isActive:false` pending review, price = cost × markup), purchase orders accept/reject, invoices, payments, profile. | Working, procurement semantics. |
| Admin | `/admin/vendors` list/detail/new, status actions (approval email), contacts, payments, ratings, GST toggle, part-category editor. | Working. |
| Part categories | Two-level `Category` tree (13 groups seeded), `VendorPartCategory` links, `VehicleSegment[]`, searchable picker, server validation in Node and Java (`PartCategoryValidator`). | Done 2026-11-05/06. Migration must be applied per environment. |

## 3. OTP & document verification

* **Email OTP:** `createOTP(userId, "EMAIL_VERIFICATION")`, hashed in `OtpCode`, sent by Resend; verify via `/api/auth/verify-email`.
* **Mobile OTP:** MSG91 through `lib/sms` provider abstraction; `/api/auth/send-mobile-otp`, `/api/auth/verify-mobile`; rate limited.
* **Documents:** `DealerDocument` / `VendorDocument` (type enum, key, url, size). Upload route sniffs bytes (`looksLikePdf`, `detectImageMimeType`),
  10 MB cap, PDF/JPG/PNG. **No verification of content** (no OCR, no name/PAN match) and **not private** (finding 4).
  Admin document viewing goes through `/api/upload/[id]` (admin-only) and `generateSignedUrl` exists but stored URLs are public anyway.
* **PAN/GSTIN:** regex + "GSTIN chars 3-12 = PAN" check (client, seller wizard). No authority lookup.
* **Bank:** collected (procurement vendor), not verified. No penny-drop.

## 4. Current activation logic

| Actor | Created as | Gate to portal | Gate to money APIs | Who activates |
|---|---|---|---|---|
| Dealer | `ACTIVE` | email + mobile verified; not SUSPENDED/REJECTED | `getVerifiedDealer` | nobody (automatic) |
| Customer | — | mobile verified | `getVerifiedCustomer` | automatic |
| Procurement vendor | `PENDING` | email + mobile verified **and** `APPROVED` | `getVerifiedVendor` — **checks status only** (gap: not `isActive`/email/mobile) | admin |

There is no state machine, status history or verification log for any actor; status changes are a single `UPDATE` with no audit row.

## 5. Admin product creation architecture

* **Form:** `components/admin/product-form.tsx` (449 lines) used by `/admin/products/new` and `/[id]/edit`; posts to `/api/products` (POST,
  admin-only) and `/api/products/[id]`. Separate admin APIs for variants, compatibility, model images, bulk stock status, consolidation, auto-groups.
* **Fields on `Product`:** name, sku (global unique), partNumber (global unique), slug, description, categoryId, brand, oemNumber, `price`
  (Int, dealer/B2B ex-GST), `mrp` (Float, **B2C GST-inclusive selling price**, see `lib/pricing/compute.ts`), gstRate, hsnCode, moq,
  weight + package dims, warranty, countryOfOrigin, `stockStatus` (3-state flag; `stock` deprecated), images (legacy `String[]` +
  `ProductImage` rows with primary/sort/thumb/medium), `compatibility String[]` (legacy) + `ProductCompatibility` rows, variants
  (`ProductVariant` with own price/mrp/**counted** stock/sku/images), `vendorId`, `source` (`MOTOXPLUS | EAUTO_IMPORT | VENDOR`).
* **Gap vs brief:** the brief asks for MRP **and** retail selling price **and** dealer price. The schema has two prices: `price` (dealer)
  and `mrp` (what B2C customers pay). A separate retail price below MRP needs a new column or an offer table (see §9).
* **Vendor form today:** `components/vendor/vendor-product-form.tsx` (295 lines) is a reduced copy (cost price only, no images, no variants,
  no structured compatibility). This is the "weaker duplicate" the brief wants removed.

## 6. Existing bulk product upload

`/admin/products/import` → `POST /api/admin/products/import` → `processImport()` (`lib/product-import.ts`, 361 lines).
XLSX/XLS only, 5 MB, synchronous in the request, row validation (required fields, GST ∈ {0,5,12,18,28}, warranty list, stock-status
aliases, category name → id, HSN defaults per category), in-file duplicate SKU detection, then **upsert by global SKU** and image
replacement from an "Image URLs" column. Template download at `/api/admin/products/import/template`. Report = success/failed rows.

Missing for vendors: CSV, vendor scoping, idempotent job id, background processing/progress, retry of failed rows, error-report
download, image file upload and filename matching, preview/confirm step, structured vehicle compatibility columns.

## 7. Image upload & R2

`lib/storage/*`: S3 client to R2, `uploadProductImage` (sharp → WebP + medium + thumbnail), byte-sniffing validators, size caps
(image 5 MB, document 10 MB, catalogue 50 MB), `generateSignedUrl`, `StorageAuditLog`, delete helpers, key folders
(`folders.dealerDocument(...)`, product folders). `/api/upload/product-image` is **admin-only**. One public bucket (`R2_PUBLIC_URL`).
Reusable for vendor product images with an ownership check; **not** acceptable for KYC as is (finding 4).

## 8. Category & vehicle compatibility models

* `Category`: two levels via `parentId`, admin CRUD + reorder + deactivate (`lib/catalog/category-admin.ts`), cached tree, used by
  storefront and the part-category picker. Bulk import should resolve **category + subcategory by name or slug against this tree**.
* Vehicles: `VehicleManufacturer → Vehicle → VehicleGeneration / VehicleVariant`, `VehiclePartSection`.
* `ProductCompatibility`: vehicle/generation/variant/section, year range, emission standard, position, **`confidence`
  (`VERIFIED | LIKELY | UNVERIFIED | INCOMPATIBLE`)** and **`source` (`MANUAL | OEM_CATALOG | IMPORTED | LEGACY_STRING | AI_INFERRED`)**.
  This already supports the brief's rule "never publish unverified OEM compatibility as confirmed": vendor-supplied fitment is
  stored as `UNVERIFIED` / `IMPORTED` and shown as "seller-reported" until a moderator confirms.

## 9. Required database changes (additive only)

Assuming decision V1 = separate marketplace seller (recommended). Owned by Flyway in schema `marketplace` per `DB-TAKEOVER.md`;
mirrored in `schema.prisma` only while Node still reads the tables.

| Change | Purpose |
|---|---|
| `UserRole` + `SELLER`, `SELLER_STAFF` (additive enum values) | Login/RBAC for sellers without touching the supplier `VENDOR` role. Already seeded in `marketplace.role_permission` (Phase 1). |
| `marketplace.seller` (user_id unique, legal name, business type, PAN, GSTIN, addresses, status, `status_reason`, timestamps) | Seller entity. Status enum = brief's `DRAFT … BLOCKED`. |
| `marketplace.seller_status_history`, `seller_verification_check` (check type, provider, result, raw response ref, actor, at) | Activation state machine + "verification history" for admin. |
| `marketplace.seller_document` (type, private object key, sha256, size, mime, verification state) | KYC docs in **private** storage. |
| `marketplace.seller_bank_account` (holder, IFSC, account no. AES-GCM, last4, verification state/provider ref) | Payout details. |
| `marketplace.seller_agreement_acceptance` (doc type, version, accepted_at, ip, user agent) | Terms, seller agreement, genuine-products declaration, accuracy declaration. |
| `marketplace.seller_part_category` (seller_id, category_id → `public."Category"`), `vehicle_segments` | Reuses the part-category tree; does not reuse the supplier link table. |
| Product ownership: reuse `Product` + `Product.vendorId`/`source`? **No** — `vendorId` points at the supplier table. Add `marketplace.seller_listing` (seller_id, product_id → `public."Product"`, seller_sku unique per seller, listing status, retail price, dealer price, MRP, MOQ, counted stock) | Seller ownership, per-seller SKU namespace, three prices, counted stock, listing status (`DRAFT … SUSPENDED`), never edits MotoXPlus master records. A seller listing for a brand-new part creates a `Product` row with `source = MARKETPLACE` (new enum value) owned by the seller. |
| `marketplace.import_job`, `import_job_row`, `import_job_image` | Async bulk import: job id, idempotency key, file hash, counts, per-row status/errors, retry without duplicates, image matching results. |
| Marketplace orders/sub-orders, shipments, settlements | As designed in `PHASE-0-AUDIT.md` §6; not repeated here. Needed only from Phase 6. |

Nothing is renamed or dropped. Existing dealers, suppliers and products are untouched.

## 10. Required APIs (Java, `/api/v1`, Bearer JWT)

| Area | Endpoints |
|---|---|
| Registration | `POST /sellers/register` (account step: creates User{SELLER} + seller DRAFT, sends email OTP), `POST /auth/email/verify`, `POST /auth/mobile/otp`, `POST /auth/mobile/verify` (ported shared services) |
| Onboarding | `GET/PUT /sellers/me/business`, `PUT /sellers/me/categories`, `PUT /sellers/me/bank`, `POST /sellers/me/documents` (multipart → private store), `POST /sellers/me/agreements`, `POST /sellers/me/submit` → runs checks |
| Activation | internal `SellerActivationService` (state machine; idempotent re-evaluation on every check result/webhook) |
| Admin | `GET /admin/sellers`, `GET /admin/sellers/{id}` (+ history, checks, signed document URLs ≤ 5 min), `POST /admin/sellers/{id}/{suspend,reactivate,block,reject,approve-review}` |
| Listings | `GET/POST /sellers/me/listings`, `GET/PATCH/DELETE /sellers/me/listings/{id}` (delete = drafts only), `POST …/{id}/duplicate`, `POST …/{id}/images`, `PATCH …/bulk` (price/stock) , `GET …/export` |
| Import | `POST /sellers/me/imports` (file + idempotency key) → job, `POST /sellers/me/imports/{id}/images`, `GET …/{id}` (progress, counts), `GET …/{id}/errors.csv`, `POST …/{id}/confirm`, `POST …/{id}/retry-failed`, `GET /sellers/me/imports/template.{csv,xlsx}` |
| Orders (phase 6+) | `GET /sellers/me/orders`, `POST …/{id}/{accept,reject,processing,ready-for-pickup}` |
| Lookups | existing `GET /api/part-categories`, vehicle search for fitment |

Every `/sellers/me/*` handler resolves the seller from the JWT subject; no endpoint accepts `sellerId`, `vendorId`, `userId`, role, price
tier or status from the client.

## 11. Reusable frontend components

`PartCategoryPicker`, `VehicleSegmentPicker`, `use-part-category-tree`, seller wizard shell (`registration-wizard.tsx`, `wizard-steps.tsx`,
`wizard-controls.tsx`: `StepRail`, `FileField`, `CheckGroup`, `PasswordInput`), `lib/seller/registration.ts` (zod step schemas,
submission states, masking), `ui/field`, `ui/button`, `ui/card`, `AuthPageLayout`, verify-email/verify-mobile pages, admin `product-form.tsx`
(to be split into a shared `ProductEditor` with role-specific field sets), admin import page (wizard steps), vendor sidebar pattern,
`VendorSupplySummary`. Design tokens: global Apple-style tokens + the scoped `mx-seller` red/black layer already used on `/become-vendor`.

## 12. Security gaps

| Gap | Where | Severity | Fix |
|---|---|---|---|
| KYC documents publicly reachable | `lib/storage/upload.ts`, dealer documents | **High** | Private bucket/prefix, key-only storage, signed URLs ≤ 5 min, audit each read. Migrate existing dealer docs. |
| Importer upserts on global SKU | `lib/product-import.ts` | **High** (if exposed to sellers) | Never expose; seller import keyed on `(seller_id, seller_sku)`. |
| `getVerifiedVendor` checks status only | `lib/auth/verified-account.ts` | Medium | Add `isActive`, email, mobile checks like dealers. |
| `xlsx@0.18.5` | dependency | Medium | Parse spreadsheets in Java (Apache POI, with size/row/cell limits) or replace with the maintained SheetJS CDN build / `exceljs`. |
| No audit trail on status changes | dealer/vendor status routes | Medium | Use `marketplace.audit_log` (append-only) for every seller/listing status change. |
| Aadhaar collected (encrypted) for dealers/suppliers | registration routes | Policy | Do not collect for sellers (brief agrees). |
| `verify-email?userId=` in URL | verification pages | Low | Acceptable (OTP required); keep rate limits. |
| No CSRF concern for Bearer-JWT Java APIs; NextAuth routes rely on SameSite cookies | — | Info | Keep seller APIs Bearer-only. |

## 12a. Structure rule: one feature = one module + one page

Owner requirement (2026-11-06): no page combines several features. Every feature gets its own route, its own frontend module
(`src/features/seller/<feature>/` with components, API client and schema) and its own backend package/controller. Pages only
compose that one module. Shared building blocks (`ProductEditor` fields, pickers, uploaders) live in `components/` and are imported, never
copied.

| Feature | Route (V1: `/vendor/*`; the `/seller/*` paths below read as `/vendor/*`) | Backend module |
|---|---|---|
| Landing | `/become-vendor` | — |
| Account | `/sell/register` | `seller.registration` |
| Email verification | `/verify-email` (shared) | `auth.verification` |
| Mobile verification | `/verify-mobile` (shared) | `auth.verification` |
| Business details | `/sell/onboarding/business` | `seller.onboarding` |
| Parts categories | `/sell/onboarding/categories` | `seller.onboarding` |
| Bank details | `/sell/onboarding/bank` | `seller.bank` |
| Documents | `/sell/onboarding/documents` | `seller.documents` |
| Review & submit | `/sell/onboarding/review` | `seller.activation` |
| Application status | `/sell/onboarding/status` | `seller.activation` |
| Overview | `/seller/dashboard` | `seller.analytics` |
| Products list | `/seller/products` | `listing` |
| Add product | `/seller/products/new` | `listing` |
| Edit product | `/seller/products/[id]` | `listing` |
| Bulk upload | `/seller/products/bulk-upload` | `listing.import` |
| Import job progress | `/seller/products/imports/[jobId]` | `listing.import` |
| Bulk image upload | `/seller/products/bulk-images` | `listing.media` |
| Bulk price update | `/seller/products/bulk-price` | `listing.bulk` |
| Bulk stock update | `/seller/inventory/bulk-stock` | `inventory` |
| Export | `/seller/products/export` | `listing.export` |
| Inventory | `/seller/inventory` | `inventory` |
| Orders | `/seller/orders`, `/seller/orders/[id]` | `order.seller` |
| Shipments | `/seller/shipments` | `shipping.seller` |
| Returns | `/seller/returns` | `returns` |
| Payments | `/seller/payments` | `finance.payments` |
| Settlements | `/seller/settlements` | `finance.settlement` |
| Analytics | `/seller/analytics` | `seller.analytics` |
| Business profile | `/seller/profile` | `seller.profile` |
| Documents (post-activation) | `/seller/documents` | `seller.documents` |
| Support | `/seller/support` | `support` |

Onboarding steps are separate routes backed by a server-saved draft. This also fixes the current wizard's "finish in one sitting"
limitation: a seller can leave and resume at the step they reached.

## 13. Proposed implementation order

Each phase is shippable behind `MARKETPLACE_ENABLED` / `NEXT_PUBLIC_SELLER_SIGNUP_OPEN` and is tested before the next starts.

| Phase | Scope | Depends on |
|---|---|---|
| **1a** Platform fixes | Private KYC storage (+ migrate dealer docs), `getVerifiedVendor` hardening | none |
| **1b** Shared services in Java | Email (Resend), SMS (MSG91), OTP (same `OtpCode` table and hashing), R2 private/public storage, registration rate limits | V3 |
| **1c** Seller account | `SELLER` role, seller tables, `/become-vendor` → landing + **Start selling** → `/sell/register` (account step), email + mobile verification, NextAuth/middleware routing for `SELLER` | V1, V3 |
| **2** Onboarding + activation | Business, categories (reuse picker), bank, documents, agreements, review; activation state machine with verification ports; admin review queue + history | V2 |
| **3** Seller dashboard shell | Sidebar, overview metrics from real APIs, business profile, documents | 2 |
| **4** Listings | Shared `ProductEditor`, images (reuse sharp pipeline), fitment as `UNVERIFIED`, publication rules, admin moderation | 3 |
| **5** Bulk import | Template, CSV/XLSX parse, validation, image matching, preview, async job + progress, retry, error CSV | 4 |
| **6** Selling & orders | Marketplace order/sub-order, inventory reservation, seller order actions | 5 + `PHASE-0-AUDIT` D6/D7 (payments, invoicing) |
| **7** Shipping & settlement views | Delhivery adapter per seller pickup location, ledger-backed settlement views | 6 |
| **8** Hardening | Cross-tenant tests, load test of import, responsive QA | all |

---

## Decisions needed before Phase 1

| ID | Decision | Recommendation |
|---|---|---|
| **V1** | Marketplace sellers vs procurement suppliers. (a) Keep suppliers on `VENDOR` + `/vendor/*`; sellers get `SELLER` + `/seller/*` (UI copy still says "vendor"). (b) Retire the procurement supplier program and convert `/vendor/*` to the seller dashboard. (c) Move suppliers to `/supplier/*` and give `/vendor/*` to sellers. | **(a)** unless procurement is unused. It needs no data migration and matches Phase 1 work already done. If you no longer buy from suppliers through the portal, (b) is simplest. |
| **V2** | Automated KYC provider for PAN, GSTIN and bank (penny-drop). Options include Cashfree Verification, Signzy, Surepass, Karza/Perfios, Razorpay (if enabled on your account). Needs an account, API keys and a per-check cost. | Pick one provider for all three checks. **Until it is live:** activation runs every automatic check that is possible (OTP, completeness, format, PAN↔GSTIN consistency, duplicates) and then routes to `UNDER_REVIEW` for a one-click admin approval, never to `ACTIVE`. When the provider is connected, passing applications go straight to `ACTIVE`. |
| **V3** | Backend for onboarding. (a) Port shared email/SMS/OTP/storage to Java first, build seller onboarding in Java (consistent with "one Java backend"). (b) Build seller onboarding on Node now, port later. | **(a)**. It adds roughly one phase up front but avoids building a second registration stack that must be rewritten. Web login stays on NextAuth until the auth cutover (D8 in `PHASE-0-AUDIT.md`). |
| **V4** | Visual language. The brief says "match the existing Apple-style site"; `/become-vendor` currently uses the scoped red/black + Space Grotesk seller theme from F1. | Keep the existing site's Apple-style tokens for the dashboard and registration, and use the red accent sparingly. Retire the separate seller theme on `/become-vendor` so the seller journey matches the main site. |
| **V5** | Pricing fields. The brief wants MRP + retail selling price + dealer price; today B2C pays `mrp`. | Store all three on `seller_listing`; leave MotoXPlus's own `Product.price/mrp` semantics unchanged. |
