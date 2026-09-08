# B2B + B2C Architecture Plan

**Status:** Draft for review — no code written yet. Approve phase-by-phase.
**Date:** 2026-09-08
**Scope:** Add a retail (B2C) channel alongside the existing wholesale (B2B) dealer system.

---

## 0. TL;DR — recommended shape

| Decision | Recommendation | Why |
|---|---|---|
| User model | Keep single `User` + add a `Customer` 1:1 model + `CUSTOMER` role | Mirrors the existing `Dealer` / `Vendor` / `Admin` 1:1 pattern exactly. `role` **is** already the "type" field — every guard in the codebase is `role === "DEALER"`. A `type` column would be a second parallel concept. |
| Approval flow | Customer = instant active. Dealer flow unchanged (email+mobile OTP, no admin approval since migration `20260829000000`). | Nothing to gate for retail. Reuse the verification machinery, just don't block browsing/checkout on it. |
| Session | Reuse NextAuth (web) + custom JWT (mobile). Add `customerId` to `buildSessionClaims()`. | One claims builder already feeds every session type. |
| Pricing | `Product.price` stays = **wholesale (excl GST)**. Add `Product.retailPrice` (excl GST) + `Product.b2cEnabled` flag. Variants get `retailPrice` too. | `mrp` is already labelled "Public Retail Price" in the admin form but is only ever shown as a strike-through — do **not** overload it as the charged price. |
| Price resolution | **One function**: `resolveUnitPrice({ product, variant, audience })` in `src/lib/pricing/`. Every call site refactored to use it. | Today the `variant?.price ?? product.price` expression is **duplicated in 5+ places** (see §2.3). Adding a second price multiplies that risk. |
| Price at order time | Snapshot into `OrderItem` (already happens) and into `Invoice` buyer fields (new). Never re-resolve after cart→order. | `OrderItem.unitPrice/gstRate/gstAmount/total` already exist and are the safety net. |
| Product availability | `b2cEnabled` default **false**. A product only appears in B2C when an admin ticks the box **and** sets `retailPrice`. | Safe default — nothing leaks to retail accidentally. Also: today the public catalog leaks the *wholesale* price to guests (see §2.3) — this plan fixes that. |
| Catalog | Separate section: `/shop` (B2C) vs `/products` + `/dealer` (B2B). Shared product DB, different resolver + different visibility filter. | Clear mental model, clean SEO split, no per-request "which price am I showing" ambiguity in a shared template. |
| Guest browsing | B2C: yes, retail price visible without login. B2B: wholesale price requires `role === "DEALER"` (tightening current behaviour). | |
| Checkout | B2C payment options = **COD + Full online only**. No `ADVANCE_20`. No MOQ. Real per-parcel shipping. | 20% advance is a dealer credit term; meaningless for retail. |
| Invoice | Conditional template, one component. B2B: recipient GSTIN + tax invoice for ITC. B2C: consumer tax invoice, no recipient GSTIN, + return/refund policy + Consumer Protection (E-Commerce) Rules 2020 disclosures. | Legal — needs a CA sign-off checkpoint (Phase 4). |
| Mobile app | **v1: stays dealer-only.** Add a B2C mode later as its own phase, or ship a separate consumer app. | The Flutter app is 100% dealer-shaped (MOQ, wholesale, 20% advance, credit limit). Retrofitting it is a project of its own. |

---

## 1. Current architecture (audit)

### 1.1 Stack
- **Web:** Next.js App Router (async params, RSC), TypeScript, Tailwind, framer-motion.
- **DB:** PostgreSQL via Prisma. Money stored as `Float` with app-level `roundToPaise()` (deliberate — see `CancellationPolicy` model comment).
- **Auth:** NextAuth (JWT strategy) for the web app + a hand-rolled `jose` JWT (`mx_access` / `mx_refresh` cookies, or `Bearer`) for mobile/API. `establishWebSession()` mints **both** cookie families from one set of claims.
- **Mobile:** Flutter (`motoxplus_app/`), Riverpod + Dio, talks to `https://motoxplus.vercel.app/api`, uses `/api/mobile/*` for auth and shared `/api/*` (cart, orders, products) with a `Bearer` token.
- **Deploy:** Hostinger VPS + PM2 (`ecosystem.config.js`); Vercel also referenced by the mobile base URL.

### 1.2 Route groups
```
src/app/(public)/   → marketing + /products + /vehicles  (no auth)
src/app/dealer/      → dealer portal          (middleware: role DEALER)
src/app/admin/       → admin/staff            (middleware: ADMIN/SUPER_ADMIN/STAFF)
src/app/vendor/      → vendor portal          (middleware: role VENDOR)
src/app/api/         → route handlers
src/app/api/mobile/  → mobile-specific auth
```

### 1.3 Auth / user model
- `User` (single table) with `role: UserRole` enum: `GUEST, DEALER, ADMIN, SUPER_ADMIN, VENDOR, STAFF, SALES, …`.
- 1:1 satellites: `Dealer`, `Admin`, `Vendor` (each `userId @unique`).
- **Dealer signup** (`/api/auth/register` and `/api/dealer/register`): creates `User{role:DEALER}` + `Dealer{status:ACTIVE}`. **No admin approval** (removed in migration `20260829000000_dealer_no_approval_default_active`). Gate = email OTP + mobile OTP, enforced by **`src/middleware.ts`** redirects (not by blocking login).
- Session claims: `src/lib/auth/identity.ts → buildSessionClaims(user)` — the single place that maps `user.dealer?.id`, `user.dealer?.status`, etc. into the token. Used by NextAuth `authorize()`, REST login, OTP login, and `establishWebSession()`.
- Request-time resolution: `getCurrentUserId(req)` (`src/lib/auth/current-user.ts`) accepts either session type. Then each route does its own `prisma.user.findUnique({ select: { role } })` + `getVerifiedDealer(userId)` (`src/lib/auth/verified-account.ts`) — **the money-guard**: checks `isActive && emailVerified && mobileVerified && dealer.status === "ACTIVE"`.
- Enforcement is **two-layer**: middleware for pages, per-handler checks for APIs. There is no shared API middleware.
- Mobile: `/api/mobile/auth/login` accepts **any role** and returns `{ accessToken, refreshToken, user, dealer }`.

### 1.4 Products & pricing
- `Product`: `price` (Float, wholesale excl GST), `mrp` (Float?, "public retail price" per admin form label — display only), `gstRate` (default 18), `moq` (default 1), `hsnCode`, `weight`/`packageWeight`, plus vendor-sourcing fields (`vendorCostPrice`, `markupPercent`, `vendorId`).
- `ProductVariant`: own `price`, `mrp`, `stock`, optional `moq`.
- Admin product form (`src/components/admin/product-form.tsx`): admin enters **MRP** → wholesale auto-fills as **30% of MRP** ("70% off MRP"); or `vendorCostPrice × (1 + markupPercent/100)`.
- **Price is resolved ad-hoc in every consumer** (the core problem this plan must fix):
  | Location | Expression |
  |---|---|
  | `src/app/api/orders/route.ts:143` | `item.variant?.price ?? item.product.price` |
  | `src/app/api/orders/route.ts:194` | same, again, inside `items.create` |
  | `src/app/dealer/checkout/page.tsx:170` | `item.variant?.price ?? item.product.price` |
  | `src/components/products/product-catalog.tsx:778` | `product.price` |
  | `src/components/products/product-detail-client.tsx:164` | `resolvedVariant ? resolvedVariant.price : product.price` |
  | `motoxplus_app/lib/core/models/product.dart:94` | `price` (direct) |
  | `src/app/(public)/products/[slug]/page.tsx:58` | `p.price` in SEO description |
- **The public catalog + product detail currently show the wholesale price to everyone**, including guests — only the *"Add to cart"* action is gated behind `role === "DEALER"`. So wholesale pricing is already public. B2C launch is a chance to fix this.
- `/api/products` GET is fully public and returns `price` + `mrp` on every product.

### 1.5 Cart / order / invoice
- `Cart` is **1:1 with `Dealer`** (`dealerId @unique`). `CartItem` → `productId` + optional `variantId`, `quantity` only (**no price snapshot** — always live).
- MOQ enforced only in `/api/cart` POST: `quantity < moq || quantity % moq !== 0`.
- `/api/orders` POST (dealer-only): re-checks stock/active, recomputes `subtotal`/`gstAmount` from live prices, `shippingCost = calcShipping()`, `grandTotal`, `amountDue = paymentType === "ADVANCE_20" ? grandTotal*0.2 : grandTotal`. Snapshots each line into `OrderItem{unitPrice,gstRate,gstAmount,total,variantLabel,variantSku}`.
- `Order`: `dealerId` **NOT NULL FK**, `paymentType: ADVANCE_20 | FULL_100 | COD`, delivery fields, `stockReserved` flag.
- Stock decrement: `src/lib/orders/stock.ts` — the single place, called at COD creation / Razorpay verify / UPI admin verify.
- `Invoice`: `dealerId` NOT NULL, `orderId @unique`, copies `subtotal/gstAmount/grandTotal` (not line items). Created in **3 places**: `/api/orders` (COD), `src/lib/payments/finalize.ts` (prepaid Razorpay), `src/app/api/admin/payments/[id]/verify/route.ts` (UPI).
- Invoice rendering: `src/components/invoice/invoice-view.tsx` — a **client component** that builds the PDF in-browser with jsPDF on download. Hardcodes "TAX INVOICE", company GSTIN from env, dealer GSTIN in "Bill To". No CGST/SGST/IGST split, no credit-note support (TODO comment in file). `pdfUrl` column exists but is unused.

### 1.6 Shipping
- `calcShipping(total)` = **flat 5% of order total, free over ₹25,000** — **duplicated** in `src/app/api/orders/route.ts:13` and `src/app/dealer/checkout/page.tsx:109` (each with its own `FREE_DELIVERY_THRESHOLD` const).
- Real courier rates exist (`src/lib/delhivery/rates.ts → calculateShippingRate`, `calculateOrderWeight`) but are only used for the *estimate* widget, not for the charged amount.
- Delhivery auto-shipment gated by `DELHIVERY_AUTO_SHIPMENT` env flag.

---

## 2. Answers to the review questions

### 2.1 Auth & user model

**New model vs `type` field:**
Add a **`Customer` model** (1:1 with `User`, `userId @unique`) and add **`CUSTOMER`** to `UserRole`. Rationale: `role` already functions as the discriminator across the entire codebase; `Dealer`/`Vendor`/`Admin` are already separate satellite tables; `buildSessionClaims()` already knows how to turn "which satellite exists" into claims. A `User.type` column would be redundant with `role` and would need every `role === "DEALER"` check rewritten anyway.

`Customer` fields (minimal): `id`, `userId`, `name`, `phone`, `defaultAddress` fields (name/line/city/state/pincode), `createdAt`. Addresses can start as one embedded address and grow into a `CustomerAddress[]` table in a later phase.

**Separating the two signup flows:**
- `POST /api/customer/register` — email + password + name + phone. Creates `User{role:CUSTOMER}` + `Customer`. **Active immediately.** Email verification: send the mail, but do **not** block browsing or checkout on it (optionally require a verified mobile OTP only for COD, to cut fraud — decision flag).
- Dealer flow (`/api/dealer/register`, `/api/auth/register`) unchanged.
- The public `/register` page becomes B2C signup. `/become-dealer` stays the dealer entry point. Keep them visually and URL-wise distinct so a retail customer never lands in the dealer funnel.

**Carrying user type in the session:**
- Web: NextAuth JWT already carries `role` + `dealerId` + `dealerStatus`. Add `customerId` to `buildSessionClaims()` and to the `jwt`/`session` callbacks + `src/types/next-auth.d.ts`.
- Mobile: `/api/mobile/auth/login` already returns `role`; add a `customer` object next to `dealer`.

**Per-route enforcement:**
- Add `src/lib/auth/verified-account.ts → getCustomer(userId)` alongside `getVerifiedDealer`. For B2C the guard is lighter: `isActive` (+ optional `mobileVerified` for COD).
- **Rule:** every route that resolves a price, a cart, an order, or an invoice must first establish **audience** = `B2B` (dealer) or `B2C` (customer) from the resolved user, and pass it explicitly to the pricing/shipping/invoice helpers. No helper infers audience from ambient state.
- `src/middleware.ts`: add `/shop/checkout`, `/account/**` to the matcher; redirect `CUSTOMER` away from `/dealer`, `/admin`, `/vendor`; redirect `DEALER`/staff away from `/account`.

**Mobile app:** see §4. Recommendation: mobile stays dealer-only for v1.

### 2.2 Pricing

**Schema change:**
```
Product:
  price          Float      // UNCHANGED — wholesale, excl GST (dealer price)
  retailPrice    Float?     // NEW — B2C selling price, excl GST
  mrp            Float?     // UNCHANGED — printed MRP / strike-through only
  b2cEnabled     Boolean @default(false)   // NEW — visible in /shop?
ProductVariant:
  retailPrice    Float?     // NEW
```
Constraint (app-level, enforced in admin save + a data check): `b2cEnabled = true` requires `retailPrice != null` (and every active variant either has its own `retailPrice` or inherits the product's). `mrp >= retailPrice >= price` is a *warning*, not a hard block (clearance items happen).

**Single resolver — `src/lib/pricing/resolve.ts`:**
```ts
type Audience = "B2B" | "B2C";
interface ResolvedPrice { unitPrice: number; gstRate: number; source: "variant" | "product"; audience: Audience; }

// Throws PriceUnavailableError if audience is B2C and no retailPrice is set.
function resolveUnitPrice(args: {
  product: { price: number; retailPrice: number | null; gstRate: number };
  variant?: { price: number; retailPrice: number | null } | null;
  audience: Audience;
}): ResolvedPrice
```
- B2B → `variant?.price ?? product.price`.
- B2C → `variant?.retailPrice ?? product.retailPrice` (falls back to product retail if the variant has none); **error if still null**.
- Callers handle `PriceUnavailableError` by hiding the product / rejecting add-to-cart — a B2C product with no retail price must never fall back to the wholesale price.

**Every current call site (from §1.4) is refactored to call this** in Phase 0 with `audience: "B2B"` hardcoded — a pure, behaviour-preserving refactor shipped and verified *before* any B2C code exists.

**Flow through cart/order/invoice:**
- **Cart:** stays price-free (live). Cart-summary endpoints resolve display price via the resolver with the current user's audience.
- **Order creation:** resolver runs **once**, result snapshotted into `OrderItem.unitPrice/gstRate/gstAmount/total`. This already happens for B2B; B2C uses the same code path with `audience` derived from the buyer.
- **Payment finalize / invoice:** read **only** the `Order`/`OrderItem` snapshot. Never re-resolve. Add buyer-identity snapshot fields to `Invoice` (below) so a later profile edit can't mutate a historical invoice.
- **Order/Invoice never call the resolver.** Only "cart → order" does.

**Product-level channel control:**
- Yes. `b2cEnabled = false` → hidden from `/shop`, `/api/shop/*`. Still fully available to B2B.
- A "B2B-only" product = `b2cEnabled: false` (the default).
- A "both channels" product = `b2cEnabled: true` + `retailPrice` set.
- (Optional later: `b2bEnabled` flag for B2C-exclusive SKUs. Not needed for v1 — default everything stays B2B.)

### 2.3 Catalog & sections

- **Separate section**, shared product table. `/shop` (B2C) and `/products` + `/dealer/products` (B2B).
- URL structure:
  - `/shop` — B2C catalog (guest OK)
  - `/shop/[slug]` — B2C product page
  - `/shop/cart`, `/shop/checkout`
  - `/account`, `/account/orders`, `/account/orders/[id]`, `/account/returns`
  - `/products`, `/products/[slug]` — stay, but **wholesale price display gated to `role === "DEALER"`** (guests see "Login as a dealer for pricing")
  - `/dealer/**` — unchanged
- **Guest browsing on B2C:** allowed. Retail price shown without login. Add-to-cart requires login (or a guest cart in a later phase — start with login-required to keep order ownership simple).
- The public API split: new `/api/shop/products` (returns `retailPrice` as `price`, filtered to `b2cEnabled && retailPrice != null`, never returns wholesale). Existing `/api/products` keeps serving the B2B/marketing catalog but should **stop returning `price` to unauthenticated callers** once `/shop` exists (SEO description in `[slug]/page.tsx:58` switches to `retailPrice`/`mrp`).

### 2.4 Checkout & payment

- **MOQ:** enforced only when `audience === "B2B"`. B2C: `quantity >= 1`, any integer. The check in `/api/cart` POST branches on the resolved user.
- **Payment options branch point:** `/api/orders` POST. Today it validates `["ADVANCE_20","FULL_100","COD"]`. New logic:
  - `audience === "B2C"` → allow only `["FULL_100", "COD"]` (+ `DIRECT_UPI` if enabled). Reject `ADVANCE_20` with 400.
  - `amountDue` computation: B2C is always full (`amountDue = grandTotal`), no 20% branch.
  - The `DIRECT_UPI`/Razorpay-enabled toggles already exist and apply to both.
- **Shipping:** B2C must use **real per-parcel rates**, not the 5% flat. Plan:
  - Extract `calcShipping` into `src/lib/shipping/quote.ts` with an `audience` arg.
  - B2B keeps the 5%/free-over-25k slab (dealers expect it, bulk economics).
  - B2C: `calculateOrderWeight(items)` → `calculateShippingRate({ origin, destinationPincode, weightKg, paymentMode })` (already built in `src/lib/delhivery/rates.ts`), with a sane floor (e.g. ₹49) and a free-shipping threshold TBD by business.
  - Delhivery order creation: `paymentMode = COD` vs `Prepaid` already handled; weight already from `calculateOrderWeight`. B2C parcels are lighter/single — the same code works, just verify the COD amount passed is the full grand total.

### 2.5 Tax & invoice

Current: one client-side jsPDF template, always "TAX INVOICE", always shows a dealer GSTIN.

**Changes:**
1. `Invoice` gets buyer-snapshot + channel fields (immutable at issue time):
   `channel (B2B|B2C)`, `buyerName`, `buyerGstin String?`, `buyerAddressLine`, `buyerCity`, `buyerState`, `buyerPincode`, `buyerPhone`, `placeOfSupplyState`.
   `dealerId` → nullable, add `customerId String?`.
2. **One `InvoiceView` component, conditional by `invoice.channel`:**
   - **B2B:** "Tax Invoice", recipient GSTIN line, HSN column (already there), (stretch: CGST/SGST vs IGST split driven by `placeOfSupplyState` vs company state — needed for clean ITC; can be a fast-follow).
   - **B2C:** "Tax Invoice" (a B2C tax invoice is still valid — recipient GSTIN simply omitted), consumer name/address, **no GSTIN field**, plus mandatory footer block: seller legal name + registered address + GSTIN, **grievance/nodal officer contact**, **return & refund policy summary + link**, order date, delivery timeline — per the **Consumer Protection (E-Commerce) Rules, 2020**.
3. **B2C returns/refund:** new `/shop/returns` policy page + `/account/orders/[id]/return` request (v1: creates a return request row / sets an intent flag + notifies admin; admin processes refund through the existing refund tooling). Dealer cancellation logic (`src/lib/orders/cancellation*.ts`) is contract-based and stays separate — do not reuse its fee schedule for consumers.
4. **Invoice numbering:** keep a single series, or split `B2B-` / `B2C-` prefixes (recommend split — cleaner GSTR-1 B2B vs B2CS reporting). Decision needed.
5. **Where it happens today:** invoice rows are created in 3 handlers (§1.5). All 3 need the buyer-snapshot fields populated — centralise into `src/lib/invoicing/create-invoice.ts` (single helper, takes the order + resolved buyer) and call it from all 3.

**Legal checkpoint:** Phase 4 does not ship without a CA reviewing (a) B2C invoice format, (b) whether B2B invoices need the CGST/SGST/IGST split now or can defer, (c) credit-note format for cancellations (existing TODO), (d) GSTR-1 reporting impact of mixed channels.

### 2.6 Admin

- `/admin/orders`: add a **channel filter** (All / B2B / B2C) and a channel column. The list query already includes `dealer.user`; add `customer.user` and switch the "customer" column to show whichever exists.
- `/admin/products`: product form gains **Retail Price** + **B2C variant retail prices** + **"List on shop" (`b2cEnabled`)** toggle, with a guard that the toggle can't be on without a retail price.
- **New `/admin/customers`** — list + detail, separate from `/admin/dealers`. Columns: name, email, phone, orders, total spent, joined. Detail: order history, addresses, disable account.
- `/admin/invoices`: channel column + filter.
- Admin dashboard stats (`/api/admin/stats`): split GMV / order count by channel.

### 2.7 Migration & backward compatibility

**Prisma migrations (grouped):**
1. `UserRole` enum: `+ CUSTOMER`. (Postgres enum add — safe, non-breaking.)
2. New table `Customer`.
3. `Product`: `+ retailPrice Float?`, `+ b2cEnabled Boolean @default(false)`. `ProductVariant`: `+ retailPrice Float?`. (Nullable / defaulted — safe.)
4. New enum `OrderChannel { B2B B2C }`. `Order`: `+ channel OrderChannel @default(B2B)`, `+ customerId String?`, `dealerId` → **nullable**. `Invoice`: same treatment + buyer snapshot columns.
5. Backfill: `UPDATE "Order" SET channel = 'B2B'` (default covers new rows; explicit for existing). Same for `Invoice`.
6. `Cart`: `+ customerId String? @unique`, `dealerId` → **nullable**. (Existing carts keep `dealerId`.)
7. Drop the DB-level `NOT NULL` on `Order.dealerId` / `Invoice.dealerId` / `Cart.dealerId` — replace with an app-level "exactly one of dealerId/customerId" invariant (and optionally a Postgres `CHECK`).

**Impact on existing dealers & orders:**
- Existing `User.role = DEALER` rows: untouched.
- Existing `Order`/`Invoice`: get `channel = B2B`, `dealerId` unchanged. Every current query filters by `dealerId` — still works.
- `getVerifiedDealer`, middleware, mobile: unchanged behaviour.
- **Risk:** any raw query or type that assumes `Order.dealerId` is non-null. Audit needed (grep `dealerId` — ~40 route files reference `"DEALER"`). Mitigation: keep `dealerId` populated for **all** B2B orders (only null for B2C), so `where: { dealerId }` queries are still correct for the dealer portal.

**Backward compatibility rules:**
- No existing endpoint changes response shape in a breaking way. New B2C endpoints are additive (`/api/shop/*`, `/api/customer/*`).
- `/api/products` keeps returning `price` until `/shop` ships; then it stops returning `price` to anon — this is the one deliberate breaking change, coordinated with the mobile release (mobile uses `/api/products` with a dealer token, so authenticated response keeps `price`).
- Mobile app: no server change breaks the current build as long as authenticated `/api/products` and `/api/orders` keep their shape. B2C fields are additive and ignored by the Dart models.

---

## 3. Phased roadmap

Each phase is independently deployable and reversible. **Money-touching phases (0, 3, 4) get a staging soak + a manual price-audit checklist before production.**

### Phase 0 — Consolidation (no user-visible change) ⚙️
**Goal:** collapse the duplicated price/shipping logic into single functions, behaviour identical.
- `src/lib/pricing/resolve.ts` — new; `resolveUnitPrice()` + `PriceUnavailableError`.
- `src/lib/shipping/quote.ts` — new; extract `calcShipping` + `FREE_DELIVERY_THRESHOLD`.
- `src/lib/invoicing/create-invoice.ts` — new; wrap the 3 invoice-creation sites.
- **Refactor call sites** (audience hardcoded `"B2B"`):
  - `src/app/api/orders/route.ts` (2 spots + shipping)
  - `src/app/dealer/checkout/page.tsx` (client — resolve via a `/api/cart` summary field instead of inline math)
  - `src/components/products/product-catalog.tsx`, `product-detail-client.tsx`
  - `src/app/api/payments/finalize.ts`, `src/app/api/admin/payments/[id]/verify/route.ts` (invoice helper)
- Add `OrderChannel` enum + `Order.channel`/`Invoice.channel` (default `B2B`, backfill). No logic reads it yet.
- **Tests:** unit tests for `resolveUnitPrice` (B2B paths), a golden-order test that asserts totals are byte-identical before/after.
- **Deploy signal:** a dealer order placed on staging produces the exact same `subtotal/gst/grandTotal/invoice` as prod.

### Phase 1 — B2C data model + admin data entry (no storefront) 🗄️
- Migrations: `Customer` table, `CUSTOMER` role, `Product.retailPrice/b2cEnabled`, `ProductVariant.retailPrice`, `Order/Invoice/Cart` nullable-dealer + `customerId` + buyer snapshot columns.
- `src/components/admin/product-form.tsx` + `/api/admin/products*`: retail price fields, `b2cEnabled` toggle + guard.
- `src/lib/pricing/resolve.ts`: implement the B2C branch (still unused by any route).
- Data check script: list products where `b2cEnabled && retailPrice == null` (should be empty).
- **Deploy signal:** admin can set retail prices; nothing else changes.

### Phase 2 — Customer accounts + B2C storefront (browse only) 🛍️
- `POST /api/customer/register`, `getCustomer()`, `buildSessionClaims` + `next-auth.d.ts` + mobile-login `customer` object.
- `src/middleware.ts`: `/account/**`, `/shop/checkout` protection + cross-role redirects.
- `/register` page → B2C signup; keep `/become-dealer` distinct.
- `/shop` + `/shop/[slug]` + `/api/shop/products` (+ search) — B2C resolver, `b2cEnabled` filter, retail price, guest-visible.
- **Gate wholesale price** on `/products` + `/products/[slug]` + `/api/products` behind `role === "DEALER"`; SEO copy switches to retail/MRP.
- `/account` shell (profile, addresses, empty orders list).
- Navbar: "Shop" entry; account menu for `CUSTOMER`.
- **Deploy signal:** a guest can browse `/shop` and see retail prices; wholesale is no longer publicly visible; no checkout yet.

### Phase 3 — B2C cart + checkout + orders 💳
- `/api/cart`: accept `CUSTOMER` (customer-owned cart via `customerId`), MOQ bypass when B2C, price summary via resolver.
- `/shop/cart`, `/shop/checkout` (address, COD / full-online only).
- `/api/orders` POST: branch on audience — B2C payment-type allowlist (`FULL_100`, `COD`, `DIRECT_UPI?`), no `ADVANCE_20`, `amountDue = grandTotal`, no MOQ, `channel = B2C`, `customerId` set, `dealerId` null, real shipping via `src/lib/shipping/quote.ts` (Delhivery rate).
- `/api/orders` GET + `/api/orders/[id]` GET: allow `CUSTOMER` to see own orders (`where customerId`).
- Payment paths (`finalize.ts`, Razorpay verify, UPI) — already snapshot-safe; just confirm they don't assume `dealerId`.
- `/account/orders` + `/account/orders/[id]` + tracking.
- **Deploy signal:** a customer places a COD + an online order; totals match a hand-calc; stock decrements; the dealer flow is provably unchanged (regression checklist).

### Phase 4 — B2C invoice + returns (legal) 🧾
- `Invoice` buyer-snapshot population in `create-invoice.ts` for all 3 creation sites.
- `InvoiceView` conditional B2B/B2C rendering.
- `/shop/returns` policy page + `/account/orders/[id]/return` request flow + admin queue.
- Consumer Protection (E-Commerce) Rules 2020 disclosure block (grievance officer, seller identity, return window).
- (Stretch, CA-driven) CGST/SGST/IGST split on B2B invoices; credit-note format.
- **CA sign-off required before production.**
- **Deploy signal:** CA-approved B2C invoice PDF; return request round-trips to admin.

### Phase 5 — Admin polish + reporting 📊
- `/admin/orders` + `/admin/invoices` channel filter/column.
- `/admin/customers` list + detail.
- `/api/admin/stats` + dashboard: per-channel GMV / count.
- Invoice numbering series split (if chosen).

### Phase 6 (optional, separate project) — Mobile B2C
See §4.

---

## 4. Mobile app impact

The Flutter app is **entirely dealer-shaped**: `Dealer` model required in `AuthState`, `Product.price` = wholesale, MOQ in cart UI, checkout offers 20% advance, dashboard shows credit limit, `/api/mobile/auth/me` returns `dealer` or fails.

**Recommendation: mobile stays B2B-only for v1.** Server changes in Phases 0–5 are designed to not break it:
- Authenticated `/api/products` keeps returning `price` (dealer token).
- `/api/orders`, `/api/cart` keep their shape for dealer tokens.
- New B2C fields are additive; Dart models ignore unknown JSON keys.

**One required mobile change (Phase 2/3 window):** `/api/mobile/auth/login` and `/me` will return a `customer` object for `CUSTOMER` accounts. Today the app treats "no dealer" as a soft failure. Add a guard: if `role == 'CUSTOMER'`, show "Please use the website to shop" (or a hard block) rather than a broken dealer dashboard. Small, ship it alongside Phase 2.

**If/when a mobile B2C mode is wanted (Phase 6):** it's a real project — parallel screens for retail catalog/cart/checkout, a `mode` switch or a second app flavor, retail pricing in `Product`, remove MOQ/advance UI, consumer invoice download, returns. Estimate it separately.

---

## 5. Where money can go wrong — risk register

| # | Risk | Where | Mitigation |
|---|---|---|---|
| R1 | B2C product with no `retailPrice` silently falls back to **wholesale price** → customer charged dealer price (too low) | resolver fallback | `PriceUnavailableError` — resolver **throws**, never falls back across audiences. `b2cEnabled` guard requires `retailPrice`. Data-check script in CI. |
| R2 | Wholesale price shown on a B2C page (or vice versa) because a shared component reads `product.price` directly | `product-catalog.tsx`, `product-detail-client.tsx`, any shared card | Phase 0 removes all direct `.price` reads. B2C uses `/api/shop/*` which never serializes wholesale. Separate `/shop` templates. |
| R3 | Price changes between add-to-cart and checkout; customer sees old price, charged new (or vice versa) | cart is live, no snapshot | Resolve + snapshot **once** at order creation (already the pattern). Show "price updated" if cart-display price ≠ order price at the confirm step. |
| R4 | Historical invoice changes because it re-reads the product/dealer instead of a snapshot | `invoice-view.tsx` reads `order.items` (OK) but buyer identity is live | Add immutable buyer-snapshot columns to `Invoice` (Phase 1); `InvoiceView` reads only `Invoice` + `OrderItem`. |
| R5 | `ADVANCE_20` reaches a B2C order → customer charged 20%, 80% never collected | `/api/orders` POST `amountDue` branch | Payment-type allowlist by audience, server-side (not just hidden in UI — mirrors the existing `RAZORPAY_ENABLED` server check). |
| R6 | B2C shipping uses the 5% flat rule → ₹300 part ships for ₹15, or free over ₹25k when it shouldn't be | `calcShipping` duplicated | `src/lib/shipping/quote.ts` with audience arg; B2C → real Delhivery rate with a floor. |
| R7 | Rounding drift when two channels sum totals differently | `roundToPaise` usage | Keep the exact per-line rounding sequence from `/api/orders` for both channels; golden-total test in Phase 0. |
| R8 | GST wrong on B2C invoice (missing split, wrong place of supply) → filing / ITC problems | invoice template | CA checkpoint Phase 4; `placeOfSupplyState` snapshotted; single `create-invoice.ts` helper. |
| R9 | MOQ bypass leaks to B2B (customer path accidentally shared) → dealer orders 1 unit at wholesale | `/api/cart` MOQ check | Branch strictly on resolved user's audience; regression test that a dealer still can't add below MOQ. |
| R10 | A dealer with a second `CUSTOMER`-looking session buys at retail-below-wholesale, or a customer somehow gets `role` widened | auth | One `User` = one `role`. No dual accounts on one email (unique constraint). `role` only settable by admin. |
| R11 | `/api/products` stops returning `price` and the **mobile app** breaks | Phase 2 change | Only anon responses drop `price`; authenticated (dealer token) keeps it. Coordinate with a mobile smoke test. |
| R12 | Cart ownership ambiguity: `Cart.dealerId` nullable + `customerId` → a query matches the wrong cart | Phase 1 migration | App-level "exactly one of" invariant + optional Postgres `CHECK`; cart lookups always keyed by the resolved principal, never by a loose `OR`. |

**Standing rule for every money-touching PR:** include a "price audit" note — which resolver path, which audience, which snapshot, hand-calc of one example order.

---

## 6. Open questions (need answers before/along the phases)

1. **Email verification for customers** — block COD until mobile OTP verified? (fraud vs friction)
2. **Guest checkout** — v1 login-required, or guest cart from the start?
3. **Free-shipping threshold for B2C** — amount? none?
4. **Invoice numbering** — single series or `B2B-`/`B2C-` split?
5. **CGST/SGST/IGST split on B2B invoices** — do it in Phase 4, or defer? (CA)
6. **Return window** — 7 / 10 days? Which categories are non-returnable (safety parts)?
7. **Mobile B2C** — commit to Phase 6, or website-only for retail indefinitely?
8. **Pricing default** — when admin sets `retailPrice`, auto-suggest from `mrp` (e.g. `= mrp`) or always manual?
9. **Does a product's `moq` field stay meaningful for B2C** (ignored) or do we want a separate `b2cMinQty` (default 1)?
10. **One cart or two** if a user were somehow both — non-issue given one role per user, but confirm no "dealer buys retail for personal use" requirement.

---

## 7. Rough sequencing

```
Phase 0  ─ consolidation ............ 1 deploy, low risk, do first
Phase 1  ─ data model + admin ....... 1 deploy, migrations
Phase 2  ─ accounts + storefront .... 1–2 deploys, B2C visible (browse)
Phase 3  ─ cart + checkout .......... money-live for B2C  ← soak on staging
Phase 4  ─ invoice + returns ........ CA sign-off gate
Phase 5  ─ admin + reporting ........ polish
Phase 6  ─ mobile B2C (optional) .... separate estimate
```

Approve phases individually. Phase 0 can start immediately — it's a safety improvement regardless of B2C.
