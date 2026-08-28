# AUDIT / 00 — Repository Map (Phase 0, read-only recon)

Generated: 2026-08-28. Working tree: branch `main`, 4 modified icon/favicon binaries only.

> This is a **map**, not an audit. Route "purpose" lines are inferred from path + HTTP method
> and a spot-read of representative files; each is confirmed file-by-file in Phase 1.

---

## 0. Up-front discrepancies vs. the brief

| # | Brief says | Repo actually has |
|---|---|---|
| D1 | Mobile = **React Native / Expo** | Mobile = **Flutter / Dart** (`motoxplus_app/`, `pubspec.yaml`, `lib/**/*.dart`). Uses `razorpay_flutter`, `dio`, `flutter_riverpod`, `go_router`, `flutter_secure_storage`. No `app.json`/Expo/`package.json` anywhere under `motoxplus_app/`. Phase I of the audit must be read as a Flutter audit. |
| D2 | Integrations: WhatsApp, Delhivery, Razorpay | Also present in code: **Shiprocket** (`src/lib/shiprocket/*`, with tests) as a second shipping integration; **MSG91 / Twilio / Fast2SMS** as alternate OTP providers (WhatsApp is one of four, `SMS_PROVIDER` selects); **Resend** for email; **Cloudflare R2** for storage. `@cashfreepayments/cashfree-js` is a dependency with **no import anywhere in `src/`**. |
| D3 | Razorpay "in progress" | Confirmed: `NEXT_PUBLIC_RAZORPAY_ENABLED` defaults `false`; live payment paths today are **Direct UPI / bank transfer (manual screenshot + admin verify)** and **COD**. Razorpay create-order/verify/webhook code exists but is gated off. |
| D4 | Two known bugs (retry dup shipment; cancel doesn't cancel with Delhivery) | Both plausible from the map — `delhiveryFetch` has `MAX_RETRIES = 3` default (`src/lib/delhivery/client.ts`), and `src/lib/delhivery/cancel.ts` exists but needs Phase 1 to confirm it's wired into `POST /api/orders/[id]/cancel`. Not yet verified. |

---

## 1. Directory tree (3 levels, build artifacts excluded)

```
motoxplus-web/
├── .github/workflows/        backup, deploy, health, restore, rollback, seed,
│                             server-tools, import-products(disabled)
├── docs/                     delhivery-audit.md, delhivery-open-items.md
├── prisma/
│   ├── data/                 cables-source.ts
│   ├── migrations/           0_init, add_product_slug, add_vehicle_type,
│   │                         order_cancellation, cancellation_policy_and_waiver
│   ├── schema.prisma
│   └── seed*.ts              seed, seed-cables, seed-mudguard, seed-descriptions,
│                             seed-vehicles, copy-mudguard-images, fix-odd-prices
├── scripts/
│   ├── db/                   backup.sh, restore.sh
│   ├── security/             idor-cross-account-test.ts
│   ├── vps/                  harden.sh, refresh-cloudflare-ips.sh
│   └── *.mjs/*.ts            visor/product one-off maintenance scripts, delhivery-capture.ts
├── src/
│   ├── app/
│   │   ├── (public)/         about, become-dealer, become-vendor, cancellation-policy,
│   │   │                     contact, privacy, terms, products, products/[slug],
│   │   │                     vehicles, vehicles/[category], vehicles/[category]/[slug]
│   │   ├── [brand]/[vehicle]/[category]/   catch-all vehicle-parts landing
│   │   ├── admin/            ~45 pages (dashboard, orders, dealers, vendors, products,
│   │   │                     vehicles, procurement, crm, payments, refunds, invoices,
│   │   │                     reviews, settings, staff, admins)
│   │   ├── dealer/           dashboard, products, cart, checkout, orders, orders/[id],
│   │   │                     orders/[id]/pay-upi, orders/[id]/tracking, invoices, documents, profile
│   │   ├── vendor/           dashboard, products, purchase-orders, payments, invoices, profile
│   │   ├── login, register, forgot-password, reset-password,
│   │   │   verify-email, verify-mobile, pending-approval
│   │   └── api/              ~146 route files (see §2)
│   ├── components/           3d, admin, auth, dealer, home, invoice, layout, orders,
│   │                         products, seo, shipping, ui, vehicles, vendor
│   ├── lib/                  see §4
│   ├── middleware.ts         next-auth withAuth — role gating + verification routing
│   ├── instrumentation.ts / instrumentation-node.ts   boot-time env + Delhivery validation, Redis warmup
│   └── types/
├── motoxplus_app/            Flutter dealer app (lib/, android/, ios/, test/)
├── tools/image-downloader/
├── ecosystem.config.js       PM2 (cluster, instances: max, 1200M restart)
├── next.config.mjs           security headers + CSP, image config
├── nginx.conf, cloudflare-ips.conf, vitest.config.ts, prisma.config.ts
└── *.md                      README, DEPLOYMENT, BACKUP, DISASTER_RECOVERY, OPERATIONS,
                              SECURITY, SECRET-ROTATION, SETUP, TESTING, VPS-HARDENING,
                              ENVIRONMENT, HOSTINGER_DEPLOY, delhivery-reference.md
```

File counts (tracked, excl. `node_modules`/`.next`/`.scratch`): **~659**. Of those `src/` TS/TSX: to be
counted exactly in Phase 2 coverage statement.

---

## 2. API surface — routes & server actions

### 2a. Route handlers (`src/app/api/**/route.ts`) — 146 files

Method column is exact (grepped). Purpose is **inferred**, pending Phase 1.

#### auth (`/api/auth/*`)
| Route | Methods | Purpose (inferred) |
|---|---|---|
| `auth/[...nextauth]` | (NextAuth) | NextAuth credentials handler |
| `auth/register` | POST | Dealer self-registration; triggers email+mobile OTP |
| `auth/login` | POST | Password login (custom, issues JWT/refresh for mobile+bearer) |
| `auth/login-otp` | POST | Request + verify login OTP (passwordless) |
| `auth/refresh` | POST | Rotate refresh token → new access token |
| `auth/logout` | POST | Invalidate current session |
| `auth/logout-all` | POST | Invalidate all user sessions |
| `auth/me` | GET | Current user profile |
| `auth/sessions` | GET, DELETE | List / revoke active `UserSession` rows |
| `auth/send-mobile-otp` | POST | Send mobile-verification OTP (WhatsApp/SMS) |
| `auth/verify-mobile` | POST | Verify mobile OTP, set `mobileVerified` |
| `auth/send-email-verification` | POST | Send email-verification OTP/link |
| `auth/verify-email` | POST | Verify email OTP |
| `auth/forgot-password` | POST | Start password reset (OTP) |
| `auth/verify-forgot-password-otp` | POST | Verify reset OTP |
| `auth/reset-password` | POST | Set new password |
| `auth/change-email` | POST | Change account email (re-verify) |

#### mobile (`/api/mobile/auth/*`)
| Route | Methods | Purpose |
|---|---|---|
| `mobile/auth/login` | POST | Flutter app login → access+refresh |
| `mobile/auth/refresh` | POST | Flutter app token refresh |
| `mobile/auth/me` | GET | Flutter app current user |

#### catalogue / public
| Route | Methods | Purpose |
|---|---|---|
| `products` | GET, POST | List (public) / create (admin) products |
| `products/[id]` | GET, PATCH, DELETE | Product read / update / delete |
| `products/search` | GET | Search-as-you-type product search |
| `categories` | GET, POST | Category list / create |
| `vehicles` | GET | Vehicle list (public) |
| `contact` | POST | Website contact form → email |

#### cart / orders / payments / shipping (dealer-facing core)
| Route | Methods | Purpose |
|---|---|---|
| `cart` | GET, POST, DELETE | Get cart / add-or-update item / clear or remove item |
| `orders` | GET, POST | List dealer orders / **place order** (stock, totals, GST) |
| `orders/[id]` | GET, PATCH | Order detail / status update |
| `orders/[id]/cancel` | POST | **Cancel order** (fee tier, refund, Delhivery cancel?) |
| `orders/[id]/cancellation-preview` | GET | Compute fee/refund before confirming |
| `orders/[id]/tracking` | GET | Live Delhivery tracking + `syncTrackingToDb` |
| `payments/create-order` | POST | Create Razorpay order (gated by flag) |
| `payments/verify` | POST | Verify Razorpay signature → `finalizeCapturedPayment` |
| `payments/upi/qr` | GET | UPI QR for an amount |
| `payments/upi/[orderId]` | GET | UPI payment status for order |
| `payments/upi/submit` | POST | Dealer submits UTR + screenshot for manual verify |
| `shipping/estimate` | POST | Shipping cost estimate (Delhivery rates) |
| `shipping/serviceability` | GET | Pincode serviceability check |
| `webhooks/delhivery` | POST, GET | Delhivery status webhook (query-token auth) |
| `webhooks/razorpay` | POST | Razorpay webhook (HMAC-SHA256), capture safety-net + refunds |

#### admin
| Route group | Methods | Purpose |
|---|---|---|
| `admin/stats`, `admin/settings`, `admin/settings/upi`, `admin/settings/verification`, `admin/settings/cancellation-policy` | GET/PUT/POST | Dashboard stats + settings (UPI VPA, GST/PAN requirements, cancellation % tiers) |
| `admin/dealers`, `admin/dealers/[id]`, `.../gst-verify`, `.../request-documents` | GET/PATCH/POST | Dealer management, GST mark-verified (internal, no external API), doc requests |
| `admin/payments`, `admin/payments/[id]/review|verify|reject` | GET/POST | Manual UPI/bank-transfer payment verification workflow |
| `admin/refunds/[id]/retry` | POST | Retry a failed cancellation refund |
| `admin/shipments` | GET, POST | List shipments / create AWB for an order |
| `admin/users/[id]/disable|verify|reset-password|unlock-login`, `admin/users/[id]` | GET/POST | User admin actions |
| `admins`, `admins/[id]` | POST/PATCH/DELETE | Super-admin manages admin accounts |
| `staff`, `staff/[id]` | GET/POST/PATCH/DELETE | Staff accounts + departments |
| `admin/products/*` | various | Import (xlsx), consolidate, auto-groups, variants, compatibility, model-images |
| `admin/vehicles/*` (large tree) | GET/POST/PATCH/DELETE | Full vehicle CMS: manufacturers, colors, generations, variants, diagrams+hotspots, gallery, faqs, spins, models-3d, recommendations, accessories, vin-patterns, sections, vehicle-types, detection-log |
| `admin/reviews`, `admin/reviews/[id]` | GET/PATCH/DELETE | Review moderation |
| `admin/test-email` | POST | Send a test email |

#### vendors / procurement / CRM
| Route group | Methods | Purpose |
|---|---|---|
| `vendors`, `vendors/[id]`, `.../status`, `.../contacts`, `.../payments`, `.../ratings`, `.../gst-verify` | GET/POST/PATCH/DELETE | Vendor master, status transitions, contacts, payments, quarterly ratings |
| `vendor/register`, `vendor/profile`, `vendor/products`, `vendor/purchase-orders`, `.../[id]/accept|reject` | GET/POST/PATCH | Vendor self-service portal |
| `procurement/requests`, `.../[id]`, `procurement/purchase-orders`, `.../[id]`, `procurement/grn` | GET/POST/PATCH | Purchase requests → POs → goods-received notes |
| `crm/leads`, `.../[id]`, `.../activities`, `.../notes`, `.../convert`, `crm/stats` | GET/POST/PATCH | Sales CRM; `convert` creates a Dealer from a Lead |
| `dealer/register`, `dealer/account` | GET/POST/DELETE | Dealer profile + account deletion |

#### files / uploads / health
| Route | Methods | Purpose |
|---|---|---|
| `upload`, `upload/[id]`, `upload/product-image`, `upload/vehicle-image`, `upload/vehicle-type-image`, `upload/dealer-document`, `upload/payment-screenshot`, `upload/company-asset` | POST/DELETE | R2 uploads (presigned or proxied) per asset class |
| `files/[id]`, `files/signed/[id]` | GET | Serve / sign R2 file URLs |
| `health`, `health/live`, `health/ready` | GET | Liveness / readiness (DB `SELECT 1`, uptime) |

### 2b. Server actions / client action components
`src/app/admin/crm/leads/[id]/lead-detail-actions.tsx`, `admin/payments/payment-actions.tsx`,
`admin/staff/staff-actions.tsx`, and `src/components/{admin/*-actions,orders/cancel-order-action,
vendor/vendor-po-actions}.tsx` — these are **client components calling the fetch API**, not
Next.js `"use server"` actions. Phase 1 to confirm no `"use server"` files exist elsewhere.

---

## 3. Prisma schema (`prisma/schema.prisma`, PostgreSQL)

### Models (57)
**Auth/identity:** User, LoginHistory, OtpCode, UserSession, Account, Session, VerificationToken
**Orgs:** Dealer, Admin, Vendor, VendorContact, VendorDocument, VendorRating, VendorPayment
**Catalogue:** Category, Product, ProductVariant, VariantImage, ProductImage
**Commerce:** Cart, CartItem, Order, OrderItem, OrderEvent, OrderCancellation, Payment, PaymentSubmission, Invoice
**Config:** Setting, CancellationPolicy (singleton), ShippingRate, Warehouse
**Shipping:** Shipment, ShipmentTrackingEvent
**Procurement:** PurchaseRequest, PurchaseRequestItem, PurchaseOrder, PurchaseOrderItem, GoodsReceivedNote, GoodsReceivedItem
**CRM:** Lead, LeadActivity, LeadNote
**Vehicle CMS:** VehicleManufacturer, Vehicle, VehicleColor, VehicleGallery, VehicleType, VehiclePartSection, VehicleGeneration, VehicleVariant, OemColor, ProductCompatibility, VehicleModel3D, VehicleSpin, VehicleDiagram, VehicleDiagramHotspot, VehicleVinPattern, VehicleDetectionLog, VehicleAccessory, VehicleProductRecommendation, VehicleFAQ, VehicleDownload
**Misc:** Review, StorageAuditLog

### Money representation
All money/percent fields are `Float` with app-level `roundToPaise()` rounding (documented decision in
schema comment on `CancellationPolicy`). No `Decimal` anywhere. **Phase 1/2 will scrutinise this for
payment + cancellation-fee + GST correctness.**

### Unique constraints (notable)
User.email, User.mobileNumber; Dealer.userId, Dealer.gstNumber; Vendor.{userId,vendorCode,email,gstNumber};
Product.{sku,partNumber,slug}; Order.orderNumber; Invoice.{invoiceNumber,orderId};
Shipment.{orderId,waybill}; OrderCancellation.orderId; UserSession.refreshToken;
PaymentSubmission.utrNumber; Cart.dealerId; DealerDocument@@unique([dealerId,documentType]);
VendorRating@@unique([vendorId,period]); VehicleVariant@@unique([vehicleId,slug]);
VehicleAccessory / VehicleProductRecommendation @@unique([vehicleId,productId]).

### Indexes present
Order: `[dealerId,status]`, `[dealerId,createdAt]`, `[status,createdAt]`, `[paymentStatus]`, `[createdAt]`.
Product: `[categoryId,isActive]`, `[isActive,createdAt]`, `[vendorId]`, `[stock]`.
OtpCode: `[userId,type,used]`, `[expiresAt]`. UserSession: `[userId,isActive]`, `[expiresAt]`.
CartItem: `[cartId]`, `[productId]`. OrderEvent: `[orderId,createdAt]`. Payment: `[orderId]`, `[status]`, `[razorpayOrderId]`.
OrderCancellation: `[refundStatus]`. PaymentSubmission: `[status,createdAt]`, `[dealerId]`, `[orderId]`.
Lead: 4 composite indexes. Vehicle CMS: FK indexes on most child models.

### Candidate gaps to check in Phase 1 (Area D)
- `Payment.orderId` has no FK-backing composite with `status` for the "is this order paid" query pattern.
- `OrderItem` has **no indexes at all** (`orderId`, `productId`, `variantId` all unindexed).
- `Invoice.dealerId`, `Invoice.orderId` (orderId is unique so OK), `PaymentSubmission` has some.
- `Shipment` has no index on `status`.
- `Review.userId` unindexed; `StorageAuditLog` has zero indexes (unbounded audit table).
- Many `VendorPayment`, `PurchaseOrder*`, `GoodsReceived*` FK columns unindexed.
- `ProductVariant.productId` unindexed (loaded on every PDP).

### Migration inventory (5)
`0_init` · `20260723140000_add_product_slug` (nullable→backfill→NOT NULL+unique) ·
`20260725120000_add_vehicle_type` · `20260728000000_order_cancellation` ·
`20260730000000_cancellation_policy_and_waiver`.
**Drift check (schema vs. applied) deferred to Phase 1 Area D** — several schema fields
(e.g. `Vehicle.aiLabels/ocrKeywords/badgeText`, `Product` package dims, `ProductImage` thumbnail/medium)
are not obviously covered by a listed migration and may have arrived via `prisma db push`.

---

## 4. External integration call sites

| Integration | Client code | Called from |
|---|---|---|
| **Delhivery** (shipping) | `src/lib/delhivery/{client,config,serviceability,rates,shipment,tracking,cancel,webhook,errors,types}.ts` | `api/orders/route` (create shipment on order?), `api/admin/shipments`, `api/orders/[id]/tracking`, `api/orders/[id]/cancel`, `api/shipping/estimate`, `api/shipping/serviceability`, `api/webhooks/delhivery`, `scripts/delhivery-capture.ts` |
| **Razorpay** (payments, gated) | `src/lib/razorpay.ts` (+ `razorpay` npm SDK), `src/lib/payments/finalize.ts` | `api/payments/create-order`, `api/payments/verify`, `api/webhooks/razorpay`, `api/orders/[id]/cancel` (refunds), `api/admin/refunds/[id]/retry` |
| **OTP delivery** | `src/lib/sms/index.ts` → `providers/{msg91,twilio,fast2sms,whatsapp}.ts`; `src/lib/auth/otp.ts`, `otp-delivery.ts` | `api/auth/{register,login-otp,send-mobile-otp,verify-mobile,forgot-password,send-email-verification}` |
| — WhatsApp Cloud API | `src/lib/sms/providers/whatsapp.ts` → `https://graph.facebook.com/<ver>/<phone_id>/messages` | via `sms/index.ts` when `SMS_PROVIDER=whatsapp` |
| — MSG91 (default) | `providers/msg91.ts` → `control.msg91.com/api/v5/otp` + `/flow` | default provider |
| — Twilio | `providers/twilio.ts` → `api.twilio.com/2010-04-01` | when selected |
| — Fast2SMS | `providers/fast2sms.ts` → `fast2sms.com/dev/bulkV2` | when selected |
| **Shiprocket** (2nd shipping integration) | `src/lib/shiprocket/{auth,client,errors,index}.ts` → `apiv2.shiprocket.in/v1/external` (email+password auth, token cached in Redis) | **No `src/app` call site found in grep** — appears wired only via `src/lib/shiprocket/index`; Phase 1 to determine if live, fallback, or dead. |
| **Email** | `src/lib/email/index.ts` (Resend SDK) + `templates/*` | `api/auth/*` (welcome, verify, otp, reset), `api/contact`, `api/payments/upi/submit`, `api/crm/leads/[id]/convert`, `api/admin/test-email`, dealer/vendor approval routes |
| **Cloudflare R2** (storage) | `src/lib/storage/{index,r2,upload,signed,delete,validate,audit,folders}.ts`, `src/lib/r2.ts` (**two r2 modules — check for dup**), `@aws-sdk/client-s3` + `s3-request-presigner` | all `api/upload/*`, `api/files/*` |
| **GST verification** | none — `api/vendors/[id]/gst-verify` and `api/admin/dealers/[id]/gst-verify` are **internal "mark as checked" toggles**, no external API by design | — |
| **Cashfree** | `@cashfreepayments/cashfree-js` in `package.json` | **no import in `src/`** — candidate dead dependency (Area K) |

---

## 5. Background jobs, crons, webhooks, queues

**No in-process job runner.** No BullMQ / node-cron / queue consumer / `setInterval` worker in `src/`.
All scheduling is GitHub Actions against the VPS over SSH:

| Workflow | Trigger | What it does |
|---|---|---|
| `deploy.yml` | push to `main`, manual | Build + deploy to `/var/www/motoxplus`, PM2 reload |
| `backup.yml` | cron `0 1 * * *` (01:00 UTC daily), manual | `scripts/db/backup.sh` → `pg_dump` → upload to R2 |
| `health.yml` | cron `*/15 * * * *`, manual | Hit `/api/health`, alert on failure |
| `restore.yml` | manual (typed confirm) | `scripts/db/restore.sh` from an R2 dump |
| `rollback.yml` | manual (commit SHA) | Redeploy an older commit |
| `seed.yml` | manual (choice) | Run a seed script on the VPS |
| `server-tools.yml` | manual (choice) | Restart pm2/nginx/postgres, tail logs, disk/mem |
| `import-products.yml` | **manual only, self-disabled** | `npm run import` script does not exist; exits 0 |

**Webhook receivers:** `POST/GET /api/webhooks/delhivery` (query-param `?token=` vs `DELHIVERY_WEBHOOK_SECRET`,
`timingSafeEqual`, fails closed in prod) · `POST /api/webhooks/razorpay` (HMAC-SHA256 of raw body vs
`RAZORPAY_WEBHOOK_SECRET`, fails closed in prod; handles `payment.captured`/`order.paid`/`payment.failed`/
`refund.processed`/`refund.failed`; always returns 200 on processing error).

**Async "safety net":** the Razorpay webhook is the only fallback that marks an order paid if the browser
never calls `/api/payments/verify`. Delhivery tracking is **pull-on-demand** via `GET /api/orders/[id]/tracking`
(`syncTrackingToDb`) — there is no scheduled tracking poll, so `Shipment.status` is only as fresh as the
last time someone opened the tracking page or a webhook fired.

---

## 6. Test infrastructure

| Thing | State |
|---|---|
| Runner | **Vitest 4.1.10** (`vitest.config.ts`, `environment: "node"`, `include: src/**/*.test.ts`) |
| Test files (14) | `src/lib/auth/{credentials,jwt,login-rate-limit,otp,rate-limit}.test.ts`, `src/lib/delhivery/{cancel,serviceability,tracking}.test.ts`, `src/lib/orders/cancellation.test.ts`, `src/lib/phone.test.ts`, `src/lib/shiprocket/{auth,client}.test.ts`, `src/lib/sms/{index,providers/whatsapp}.test.ts` |
| Coverage | **`src/lib` only.** Zero tests for API routes, React components, middleware, or Prisma-touching code paths. No coverage reporter configured. |
| E2E | `playwright` is a devDependency but there is **no `playwright.config`**. Ad-hoc scripts live in `.scratch/e2e/` and `.scratch/audit-shots*.mjs` (not part of `npm test`). |
| Mobile | `motoxplus_app/test/widget_test.dart` — default Flutter counter test only. |
| CI | No workflow runs `npm test` / `vitest` — tests are local-only. `deploy.yml` builds but does not test. (confirm in Phase 1 J) |

---

## 7. Package versions

### Web (`package.json`)
| Package | Version |
|---|---|
| next | `15.5.21` |
| react / react-dom | `^18` |
| prisma / @prisma/client | `^6.19.3` |
| next-auth | `^4.24.14` |
| @auth/prisma-adapter | `^2.11.2` |
| razorpay | `^2.9.6` |
| @cashfreepayments/cashfree-js | `^1.0.7` (unused) |
| resend | `^6.17.1` |
| ioredis | `^5.11.1` |
| @aws-sdk/client-s3 / s3-request-presigner | `^3.1069.0` |
| zod | `^4.4.3` |
| bcryptjs | `^3.0.3` |
| jose | `^6.2.3` |
| jspdf / jspdf-autotable | `^4.2.1` / `^5.0.8` |
| framer-motion | `^12.40.0` |
| three / @react-three/fiber / drei | `^0.185.0` / `^8.18.0` / `^9.122.0` |
| tailwindcss | `^3.4.1` |
| xlsx | `^0.18.5` (known CVE history — flag for `npm audit` in Area J) |
| vitest | `^4.1.10` |
| playwright | `^1.61.1` |
| typescript | `^5` |

Node target: **20** (`.github/workflows`, `NODE_VERSION: "20"`; PM2 `NODE_OPTIONS=--max-old-space-size=1024`).

### Mobile (`motoxplus_app/pubspec.yaml`, Flutter, Dart SDK `^3.12.2`)
dio `^5.7.0` · flutter_riverpod `^2.6.1` · riverpod_annotation `^2.6.1` · go_router `^14.6.3` ·
flutter_secure_storage `^9.2.4` · cached_network_image `^3.4.1` · intl `^0.19.0` ·
**razorpay_flutter `^1.3.8`** · shared_preferences `^2.3.5` · shimmer `^3.0.0` · url_launcher `^6.3.1` · badges `^3.1.2`

---

## 8. Auth architecture (quick orientation for Phase 1 Area A)

- **Two parallel session systems:** (1) NextAuth v4 credentials provider + Prisma adapter (`Session`/`Account`
  tables, cookie `__Secure-next-auth.session-token` in prod / `next-auth.session-token` in dev) drives the
  **web** middleware gating; (2) a **custom JWT + refresh-token** system (`src/lib/auth/jwt.ts`,
  `UserSession` table, `jose`, `JWT_SECRET`) drives the **Flutter app** and any Bearer clients
  (`/api/mobile/auth/*`, and likely other `/api` routes accept both).
- Middleware (`src/middleware.ts`) matches only page routes (`/dealer`, `/admin`, `/vendor`, auth pages,
  verification pages) — **not `/api/*`**. Every API route must do its own authz. This is the single
  biggest Phase 1 Area A + E surface.
- Roles: 12-value `UserRole` enum. Middleware treats `["ADMIN","SUPER_ADMIN","STAFF"]` as admin;
  `require-admin.ts` / `staff-access.ts` / `require-admin` helpers exist in `src/lib` — Phase 1 to map
  which routes use which and where raw `getServerSession` role checks are hand-rolled inconsistently
  (already saw `["ADMIN","SUPER_ADMIN"]` without STAFF in `vendors/[id]/gst-verify`).
- Verification/approval gating is done in **middleware routing**, not at login — a correct password always
  issues a session.

---

## Phase 0 status: COMPLETE

Nothing was modified. Awaiting go-ahead for **Phase 1 (exhaustive read-only audit)**.

Suggested Phase 1 execution order (largest risk first): A (auth/authz on all ~146 routes) →
B (payments incl. the Float money model) → C (Delhivery, confirm the 2 known bugs) →
D (data layer, indexes, transactions, races) → E (API validation/errors/rate-limit) →
F/G (Next 15 + Redis) → H/I (web + Flutter UI, needs the app running) → J/K (ops, security, dead weight).

Given ~146 routes + 57 models + a Flutter app, Phase 1 will not fit one session — it will checkpoint
into `AUDIT/01-findings.md` with a coverage checklist and a resume pointer.
