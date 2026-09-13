# MotoXplus — B2C Retail Channel Expansion Plan

**Status:** Draft for review · **Owner:** Manish Giri · **Last updated:** 2026-09-08
**Supersedes:** the earlier informal plan (never committed). This document is the single source of truth for the B2C build.

> Compliance basis: `compass_artifact` India B2B+B2C e-commerce compliance reference (Sept 2026),
> corrected in §7 below. Rule/section/notification numbers trace to CBIC, indiacode.nic.in and UIDAI
> primary texts. This is an implementation plan, not legal advice — a CA/counsel sign-off gate is
> built into Phase 5.

---

## 1. Goal

Add a **B2C retail channel** (end consumers buying OEM-compatible two-wheeler spare parts) alongside the
existing **B2B dealer channel**, on the same Next.js platform, same catalogue, same admin.

Non-negotiables:

- The B2C channel must not regress or destabilise the live B2B channel. Every phase ships behind the
  channel seam introduced in Phase 0.
- No B2C go-live until the **hard legal blockers** (§7 "Blockers") are all closed.
- Money math stays exact-to-the-paisa (`Float` + `roundToPaise()` convention — see
  `prisma/schema.prisma` money comment; not changing to `Decimal` in this project).

---

## 2. Current-state audit (as of 2026-09-08)

### 2.1 Pricing

| Fact | Location |
|---|---|
| `Product.mrp` = public retail price (MRP). `Product.price` = wholesale/dealer price, auto-set to **30% of MRP** (admin can override). GST added on top at checkout. | `src/components/admin/product-form.tsx:273-309` |
| `ProductVariant.price` / `.mrp` mirror the same pair per variant. | `prisma/schema.prisma:225-236` |
| Order line price is resolved inline: `item.variant?.price ?? item.product.price` — **wholesale only**, no audience concept. | `src/app/api/orders/route.ts:143`, `:194` |
| No `src/lib/pricing/*` module exists. No `retailPrice` column (MRP currently doubles as the retail price). | — |

### 2.2 Shipping

| Fact | Location |
|---|---|
| Order creation uses a **placeholder**: `calcShipping()` = 5% of (subtotal+GST), **free ≥ ₹25,000**. Does **not** call the real rate engine. `clientShippingCost` is destructured and then ignored. | `src/app/api/orders/route.ts:11-16`, `:93`, `:157` |
| A real Delhivery rate engine exists but is only wired to `POST /api/shipping/estimate`: `calculateShippingRate()` → live Delhivery `rate-calculator` API → DB `ShippingRate` slabs → ₹100 flat default. | `src/lib/delhivery/rates.ts` |
| No `src/lib/shipping/*` module. No ₹49 floor anywhere. | — |

### 2.3 Invoicing & GST

| Fact | Location |
|---|---|
| GST is stored as a **single consolidated `gstAmount`** on `Order`, `OrderItem` (+ `gstRate`), and `Invoice`. **No CGST / SGST / IGST columns anywhere.** | `prisma/schema.prisma:336-508` |
| GST computed as one figure: `itemGST = itemSubtotal * product.gstRate / 100`. | `src/app/api/orders/route.ts:145` |
| Invoice number: `generateInvoiceNumber()` → `INV/<calendarYear>/<last-6-of-timestamp>`. Single series, calendar year (not FY), not provably consecutive. | `src/lib/utils.ts:31-36` |
| Invoice PDF + on-screen view show one "GST Amount" line and a per-item "GST %" column. No tax-head breakup, no "place of supply", no recipient State code. | `src/components/invoice/invoice-view.tsx:104-136`, `:261-287` |
| `Order.deliveryState` is captured (free-text string) but **never used for tax logic**. | `src/app/api/orders/route.ts:190` |
| Seller/origin state lives only in `NEXT_PUBLIC_COMPANY_GST` env and (unused) `Warehouse.state`/`Warehouse.gstin`. | `src/components/invoice/invoice-view.tsx:89`, `prisma/schema.prisma:800-812` |
| **Three** invoice-creation sites, each hand-building `{invoiceNumber, orderId, dealerId, subtotal, gstAmount, grandTotal}`: | |
| — COD checkout | `src/app/api/orders/route.ts:226-235` |
| — prepaid (Razorpay verify + webhook) | `src/lib/payments/finalize.ts:83-93` |
| — manual UPI/bank-transfer verify | `src/app/api/admin/payments/[id]/verify/route.ts:85-96` |
| `Product.hsnCode` defaults to `""`. `Product.countryOfOrigin` defaults to `"India"`. | `prisma/schema.prisma:194-195` |

### 2.4 Orders

- `Order` has **no `channel` / audience field**. Every order today is a dealer (B2B) order — `POST /api/orders`
  hard-rejects any non-`DEALER` role (`src/app/api/orders/route.ts:80`).
- `OrderItem` has no indexes (noted in `AUDIT/00-map.md` §3).
- Cart is 1-per-dealer (`Cart.dealerId` unique).

### 2.5 Auth & KYC

- **Registration already does email + mobile OTP** (`/api/auth/register`, `/api/dealer/register` → redirect to
  `/verify-email` → `/verify-mobile`). Two session systems: NextAuth v4 (web) + custom JWT/refresh (Flutter).
- Dealer/vendor registration currently collects an **optional Aadhaar number**, encrypted at rest
  (`encrypt()`), "never verified externally":
  - `src/components/dealer/registration-form.tsx:22`, `:260-272`
  - `src/components/auth/register-form.tsx:18`, `:142-144`
  - `src/components/vendor/vendor-registration-form.tsx:38`, `:201-203`
  - API: `src/app/api/dealer/register/route.ts:22`,`:75`; `src/app/api/auth/register/route.ts:35`,`:88`; `src/app/api/vendor/register/route.ts:30`,`:95`
  - Schema: `Dealer.aadhaarNumber`, `Vendor.aadhaarNumber` (`String?`, encrypted)
- "GST verify" / "PAN verify" today are **internal admin toggles only** — no external API
  (`src/app/api/admin/dealers/[id]/gst-verify/route.ts`, `AUDIT/00-map.md` §4).
- Config gate exists: `getVerificationConfig()` → `verification_gst_required` / `verification_pan_required`
  settings (`src/lib/settings/verification.ts`).

### 2.6 Money model

All money is Prisma `Float` with `roundToPaise()` applied at each computation step. Deliberate, documented,
**out of scope to change** — new fields follow the same convention.

---

## 3. Decisions (locked 2026-09-08)

| # | Decision |
|---|---|
| D1 | **Both channels: email + OTP verification.** B2C is **login-required, no guest checkout** in v1. |
| D2 | **B2B KYC:** GSTIN mandatory (verified via gst.gov.in "Search Taxpayer" / GSP API → legal name + address + active status), **plus PAN**. Non-GST-registered dealers (below ₹40 lakh goods threshold): **PAN + Udyam registration + Shop & Establishment / bank proof**. **Aadhaar is never requested and never stored.** |
| D3 | **Invoice numbering: split series.** `B2B/<FY>/<n>` and `B2C/<FY>/<n>`, each consecutive & unique per financial year. Rule 46(b) explicitly permits "one or multiple series"; the split mirrors GSTR-1 (Table 4 B2B invoice-wise vs Table 7 B2CS consolidated). |
| D4 | **CGST/SGST/IGST split is built in Phase 1, not deferred.** Head-wise split is legally mandatory (Rule 46); a consolidated "GST" figure is non-compliant. IMS is mandatory from 1 Apr 2026 and place-of-supply-mismatched records bypass IMS entirely → the dealer's ITC cannot be recovered. Our dealers are in 18+ states ⇒ mostly IGST. |
| D5 | **B2C invoice ≥ ₹50,000:** capture recipient **name, address, and State + code** on the invoice (Rule 46(f)). Always capture place-of-supply State + code for inter-State B2C regardless of value. |
| D6 | **Shipping: no free-shipping threshold.** Charge **Delhivery real rate with a ₹49 floor** (`max(delhiveryRate, 49)`). Applies to B2C; B2B keeps its current behaviour until a later decision. |
| D7 | **Returns: 7-day window.** Non-returnable (disclosed upfront, applied consistently): installed electrical/electronic parts, safety-critical parts once fitted, opened consumables, custom/special-order items, parts damaged by wrong installation. **Genuinely defective or mis-described goods are always accepted regardless of policy.** Refund SLA: **7–10 days** from receipt of returned goods, published and honoured. |
| D8 | `retailPrice` added to the admin product form, **auto-filled = `mrp`**, admin-editable. MRP stays the legal ceiling; `retailPrice` is what B2C actually pays. |
| D9 | **No `b2cMinQty` / MOQ for B2C.** `Product.moq` / `ProductVariant.moq` are ignored on the B2C channel. |
| D10 | **Mobile B2C (Flutter) is in scope — Phase 6, estimated separately.** |
| D11 | **e-Invoicing (IRN via IRP): not applicable.** AATO confirmed below ₹5 crore (Notification 10/2023-CT threshold). Plan carries only a threshold monitor + a watch on the proposed ₹2 crore reduction. |

### Confirmed non-issues

- Multiple parallel invoice series need no intimation to the GST department (Rule 46(b)).
- e-Invoicing / dynamic B2C QR — not triggered at current turnover.
- `Float` money model — staying.

---

## 4. Architecture: the channel seam

Everything downstream keys off one enum.

```prisma
enum OrderChannel {
  B2B
  B2C
}
```

- `Order.channel  OrderChannel @default(B2B)` — backfill all existing rows to `B2B`.
- `Invoice.channel OrderChannel @default(B2B)` — backfill; drives the numbering series (D3).

Three pure modules, one responsibility each, both channels flow through them:

| Module | Signature (target) | Phase 0 behaviour | Later |
|---|---|---|---|
| `src/lib/pricing/resolve.ts` | `resolvePricing({ audience: OrderChannel, items }) → ResolvedLine[]` | `audience` only ever `"B2B"`; returns `variant?.price ?? product.price` exactly as today | Phase 2/3: `B2C` → `retailPrice ?? mrp`, ignore MOQ |
| `src/lib/shipping/quote.ts` | `quoteShipping({ channel, subtotal, gstAmount, ... }) → ShippingQuote` | reproduces `calcShipping(subtotal+gstAmount)` byte-for-byte (5%, free ≥ ₹25k) | Phase 3: `B2C` → `max(delhiveryRate, 49)`, no threshold |
| `src/lib/invoicing/create-invoice.ts` | `createInvoice(tx, { order, dealer, channel }) → Invoice` | consolidates the 3 sites; identical `{subtotal, gstAmount, grandTotal}` output; series still `INV/...` | Phase 1: tax-head split, split series, ₹50k fields |

**Phase 0 guarantee:** for any given cart, `subtotal / gstAmount / shippingCost / grandTotal / amountDue`
are **byte-identical** before and after the refactor. Enforced by the golden-order test (§6).

---

## 5. Phases

Effort key: **S** ≤2d · **M** 3–5d · **L** 1–2wk · **XL** 3wk+. Single-developer estimates.

### Phase 0 — Refactor & channel seam · **M** · *no behaviour change*

1. `src/lib/pricing/resolve.ts` — extract line-price resolution (`audience: "B2B"` only).
2. `src/lib/shipping/quote.ts` — extract `calcShipping`, exact behaviour.
3. `src/lib/invoicing/create-invoice.ts` — consolidate the 3 invoice-creation sites.
4. Refactor all call sites: `src/app/api/orders/route.ts`, `src/lib/payments/finalize.ts`,
   `src/app/api/admin/payments/[id]/verify/route.ts`.
5. Prisma: `OrderChannel` enum, `Order.channel`, `Invoice.channel` (both `@default(B2B)`). Migration +
   backfill existing rows.
6. **Golden-order test** (§6) — totals byte-identical before/after.
7. `npx tsc --noEmit` clean. Existing Vitest suite green.

**Exit:** merged, live B2B behaviour provably unchanged, seam in place.

### Phase 1 — GST correctness (B2B + B2C) · **L**

1. Schema: add `cgstAmount` / `sgstAmount` / `igstAmount` to `Order`, `OrderItem`, `Invoice` (Float,
   `@default(0)`). Add `placeOfSupplyState` + `placeOfSupplyCode` to `Order`/`Invoice`. Add
   `sellerStateCode` (derive from `NEXT_PUBLIC_COMPANY_GST` first 2 digits, or a `Warehouse` row).
2. `src/lib/tax/place-of-supply.ts` — seller state + destination state → intra (CGST+SGST) vs inter (IGST),
   per IGST Act s.7/8 and s.10(1)(a)/(ca). Unit-tested against a state matrix.
3. `resolvePricing` / `createInvoice` emit the head-wise split. `gstAmount` retained as the sum for
   backward compatibility.
4. **Backfill migration:** for every historical `Order`/`Invoice`, split `gstAmount` using
   `deliveryState` vs seller state. Log any row where `deliveryState` is null/unrecognised for manual review.
5. Invoice series split (D3): `B2B/<FY>/<n>` / `B2C/<FY>/<n>`, per-FY consecutive counters
   (dedicated `InvoiceCounter` table or `SELECT ... FOR UPDATE` on a settings row — must be
   transaction-safe under concurrency). Retire `generateInvoiceNumber()`.
6. **₹50,000 B2C rule (D5):** `createInvoice` requires recipient name/address/State+code when a B2C
   invoice value ≥ ₹50,000; always stores place-of-supply State+code for inter-State B2C.
7. Invoice view + PDF + `invoice-generated` email redesigned: CGST/SGST/IGST columns (zeros shown),
   place of supply with State code, HSN-wise tax summary, seller + recipient GSTIN, FY-based series.
8. `npx tsc --noEmit`, tests, and a manual reconciliation of 10 sample historical invoices.

**Exit:** every invoice (old and new) carries a compliant head-wise split and place of supply.

### Phase 2 — B2C catalogue, product page, privacy foundation · **L**

1. `retailPrice` on `Product` + `ProductVariant` (D8): nullable Float, admin form auto-fills = `mrp`,
   editable. `resolvePricing` B2C branch → `retailPrice ?? mrp`.
2. Public product listing/detail pages surface **Legal Metrology Rule 6(10)** declarations on every B2C
   listing: MRP (single inclusive-of-all-taxes figure), net quantity, manufacturer/packer/importer
   name + address, consumer-care name/phone/email, country of origin. (Month/year of manufacture is
   exempt on the listing.) New `Product` fields where missing: `netQuantity`, `packerName`,
   `packerAddress`, `consumerCareEmail`, `consumerCarePhone`. Admin form + validation + a
   "listing-complete" gate before a product is B2C-visible.
3. **DPDP basics:** privacy notice at point of collection (Section 5), consent capture with **no
   pre-ticked boxes**, unbundled (Section 6). Cookie/analytics consent. Store consent records with
   timestamp + notice version.
4. B2C-visible flag on `Product` (a product can be B2B-only, B2C-only, or both).

**Exit:** a consumer can browse a compliant catalogue; privacy notice + consent live.

### Phase 3 — B2C accounts, cart, checkout · **L**

1. B2C user role + registration (email + OTP, login-required — D1). Reuse the existing OTP
   infrastructure; new consumer onboarding flow (no company/GST fields).
2. B2C cart (per-user, MOQ ignored — D9).
3. B2C checkout: `resolvePricing({ audience: "B2C" })`, `quoteShipping` B2C branch →
   `max(delhiveryRate, 49)`, **no free-ship threshold** (D6). Real Delhivery rate via
   `calculateShippingRate()` (already exists).
4. Place-of-supply capture in the checkout address step; ₹50k-rule fields collected when the running
   total crosses the threshold (D5).
5. Payment: Razorpay path (currently flag-gated) or the existing UPI/COD paths, reused via the channel seam.
6. Order creation through the seam with `channel: "B2C"`.

**Exit:** a logged-in consumer can place a paid B2C order with a correct invoice.

### Phase 4 — B2C order lifecycle, returns, grievance & DPDP completion · **L**

1. Returns (D7): 7-day window, disclosed exclusion list, refund SLA 7–10 days. Return-request flow,
   admin approval, refund tracking. Defective/mis-described goods always accepted (policy cannot override).
2. **Consumer Protection (E-Commerce) Rules 2020:** site-wide disclosures — legal name, registered
   address + branches, customer-care contact, **grievance officer (name / designation / contact)**,
   resident **nodal officer** (Rule 4(1)). Grievance workflow: **acknowledge within 48 hours, resolve
   within 1 month** (Rule 4(5)), with SLA timers and an audit trail. All-inclusive pricing at checkout
   (no hidden fees), return/refund/exchange/cancellation policy pages, delivery-timeline disclosure.
3. **DPDP completion:** data-principal rights workflow (summary / correction / erasure / nominate —
   Sections 11–14), grievance redressal, retention/erasure job (Section 8(7)), breach-response
   runbook (Board initial intimation without delay + detailed report within 72 hours; affected-principal
   notice without delay; no materiality threshold). Confirm CERT-In 6-hour incident reporting path.
4. B2C order status emails / notifications.

**Exit:** full consumer lifecycle + all soft-launch-blocking compliance in place.

### Phase 5 — B2B KYC rebuild, admin tooling, launch readiness · **L**

1. **Remove Aadhaar** from all registration forms + APIs + drop/blank the `aadhaarNumber` columns
   (D2). Migration to null out existing encrypted values.
2. GSTIN verification integration: GSP API (or gst.gov.in "Search Taxpayer" scrape fallback) →
   auto-populate legal name, principal address, registration status; block onboarding on
   Cancelled/Suspended. Store the verification snapshot + timestamp.
3. Non-GST dealer path: PAN + Udyam (udyamregistration.gov.in / MSME API) + Shop & Establishment /
   bank proof upload. Wire into `getVerificationConfig()`.
4. PAN verification (Protean/NSDL or income-tax API).
5. Admin: channel filter across orders / invoices / dashboards; GSTR-1 export helper (Table 4 / 5 / 7
   split); grievance queue; return queue.
6. **Compliance sign-off gate:** CA review of invoice format + GSTR-1 mapping + credit-note handling;
   counsel review of returns policy, T&Cs, privacy notice, grievance SLAs.
7. Load/perf pass, security review (`/security-review`), pen-test of the new consumer surface.

**Exit:** B2C web go-live.

### Phase 6 — Mobile B2C (Flutter) · **estimate separately**

The existing `motoxplus_app/` is a **Flutter dealer app** (`AUDIT/00-map.md` D1 — brief said RN/Expo,
reality is Flutter). B2C mobile options, to be scoped after Phase 3 API stabilises:

- **6a — Extend the existing Flutter app** with a consumer mode (shared auth/networking, new
  navigation stack, consumer catalogue/cart/checkout screens, `razorpay_flutter` already present).
  Est. **L–XL**.
- **6b — Separate consumer Flutter app** (clean IA, own store listing, shared API client package).
  Est. **XL**.
- **6c — PWA-first**, defer native. Est. **M** (mostly Phase 2–4 responsive polish).

Recommendation pending: **6a** if the consumer and dealer journeys can share a shell without UX
compromise; otherwise **6c** to launch, **6b** later. Full estimate delivered as a Phase 6 sub-plan
once Phase 3 lands.

---

## 6. Golden-order test (Phase 0 gate)

`src/lib/__tests__/golden-order.test.ts` (or colocated). Purpose: prove the Phase 0 refactor changes
**zero** numbers.

- Fixtures: 3–5 fixed carts covering single-line, multi-line, variant lines, mixed GST rates,
  above and below the ₹25,000 free-ship line, `ADVANCE_20` / `FULL_100` / `COD`.
- For each fixture, assert the exact `subtotal`, `gstAmount`, `shippingCost`, `grandTotal`, `amountDue`
  and every `OrderItem.{unitPrice, gstRate, gstAmount, total}` against **values pinned from `main`
  before the refactor** (captured by running the current inline logic once and hard-coding the output).
- The test must import the **new** `resolvePricing` / `quoteShipping` / `createInvoice` and reproduce
  those pinned values exactly. Any diff fails the build.
- Keep the fixtures after Phase 0 — Phase 1 extends them with expected CGST/SGST/IGST splits.

---

## 7. Risk register

Severity: **P0** blocks B2C go-live · **P1** fix before soft launch · **P2** fix before scale · **P3** monitor.

| ID | Risk | Sev | Rule / basis | Mitigation | Phase |
|---|---|---|---|---|---|
| R1 | Invoice shows a single consolidated "GST" — no CGST/SGST/IGST head-wise split. Non-compliant for **both** channels. | **P0** | CGST Rule 46 (tax shown by head) | Head-wise split in `createInvoice`; backfill historical rows | 1 |
| R2 | Place of supply never computed. Wrong tax head on B2B invoices → dealer ITC blocked: POS-mismatched records **bypass IMS** (mandatory since 1 Apr 2026) and become non-claimable; recovery only via a Section 77 / IGST s.19 refund cycle. | **P0** | IGST Act s.7/8, s.10(1)(a)/(ca); IMS via Notification 16/2025-CT & 18/2025-CT | `src/lib/tax/place-of-supply.ts`, state matrix tests, checkout captures destination State+code | 1 |
| R3 | B2C invoice ≥ **₹50,000** to an unregistered buyer without recipient name/address/State+code. | **P0** | CGST Rule 46(f) | Conditional capture in checkout + `createInvoice` guard | 1 (fields) / 3 (capture) |
| R4 | Legal Metrology declarations missing on B2C listings (MRP, net quantity, maker/packer name+address, consumer-care, country of origin). | **P0** | Legal Metrology (Packaged Commodities) Rules 2011, Rule 6(10) | New `Product` fields + admin gate + product-page rendering | 2 |
| R5 | No grievance officer / nodal officer / 48-hour-ack + 1-month-resolve grievance flow. | **P0** | Consumer Protection (E-Commerce) Rules 2020, Rule 4(1) & 4(5) | Officer disclosures + SLA-timed grievance workflow | 4 |
| R6 | No published/honoured return & refund policy; risk of a blanket "no returns" that illegally refuses defective goods. | **P0** | Consumer Protection (E-Commerce) Rules 2020 | 7-day policy + disclosed exclusions + defined refund SLA; defective goods always accepted (D7) | 4 |
| R7 | **Aadhaar collected** at dealer/vendor registration (even "optional" + encrypted). A private company cannot mandate Aadhaar; unauthorised handling → civil penalty up to **₹1 crore per contravention** + ₹10 lakh/day continuing (this is **Section 33A**, frequently mis-cited as s.42). | **P1** | Aadhaar Act s.57 struck down (*Puttaswamy* 2018) & omitted by 2019 Amendment; s.4(3)/(6)/(7); s.33A | Remove Aadhaar from all forms/APIs; null out stored values; KYC = GSTIN + PAN, or PAN + Udyam + S&E/bank proof (D2) | 5 |
| R8 | No DPDP notice / consent / data-principal-rights / breach-reporting. Board penalty powers from **13 Nov 2026**; full obligations **13 May 2027**. | **P1** | DPDP Act 2023 + DPDP Rules 2025 (G.S.R. 846(E), 13 Nov 2025); s.5, s.6, ss.11–14, s.8 + Rule 7 | Notice + consent in Phase 2; rights + 72-hour breach report in Phase 4; well before deadlines | 2 / 4 |
| R9 | Invoice series not provably consecutive per **financial year** (currently calendar year, timestamp-suffixed). | **P1** | CGST Rule 46(b) | FY-based consecutive counters, transaction-safe; split B2B/B2C series (D3) | 1 |
| R10 | **B2CL threshold is ₹1 lakh, not ₹2.5 lakh** — reduced w.e.f. **1 Aug 2024** by Notification 12/2024-CT (amended Rule 59(4): "two and a half lakh rupees" → "one lakh rupees"). Inter-State B2C invoices **> ₹1 lakh** must be reported **invoice-wise** in GSTR-1 **Table 5 (B2CL)**; at/below that they roll into Table 7 (B2CS) consolidated. *(Corrects the earlier plan and the compliance doc's stale ₹2.5 lakh figure.)* | **P1** | Notification 12/2024-CT dated 10 Jul 2024; Rule 59(4) | GSTR-1 export helper splits Table 4 / 5 / 7 on the ₹1 lakh line; invoice data model must retain per-invoice inter-State B2C detail | 5 (export) |
| R11 | Money is `Float`; head-wise split adds more summed terms → more rounding surface. | **P2** | — | `roundToPaise()` at every step; golden test asserts `cgst+sgst+igst == gstAmount` to the paisa | 1 |
| R12 | Shipping placeholder (5%, free ≥ ₹25k) still live on B2B after B2C moves to real rates → two inconsistent shipping models. | **P2** | commercial | Phase 3 moves B2C to `max(delhiveryRate, 49)`; B2B migration decision logged as an open question | 3 |
| R13 | Cancelled order with a non-zero cancellation charge still shows the original tax invoice unchanged (no credit note). | **P2** | GST credit-note rules; existing `TODO(cancellation-charges)` in `invoice-view.tsx:49` | Credit-note format + numbering series confirmed by CA in the Phase 5 sign-off gate | 5 |
| R14 | AATO crosses **₹5 crore** → e-Invoicing (IRN via IRP) becomes mandatory for the **B2B series only** (never B2C). Also watch the proposed **₹2 crore** reduction (discussed at GST Council, not notified as of mid-2026). | **P3** | Notification 10/2023-CT | Quarterly turnover check; if crossed, add an IRN-generation phase (B2B only; + 30-day IRN reporting if AATO ≥ ₹10 cr) | monitor |
| R15 | AATO crosses ₹500 crore → dynamic B2C QR on invoices. Not near-term. | **P3** | Notification 14/2020-CT | Monitor only | monitor |
| R16 | Designation as a Significant Data Fiduciary (by data volume/sensitivity) → DPO + DPIA + annual audit. | **P3** | DPDP Act s.10 | Monitor consumer data volume; revisit at scale | monitor |

---

## 8. Open questions

1. **B2B shipping** (R12): keep the 5%/free-≥₹25k placeholder, or move B2B to real Delhivery rates too?
   Recommendation: move both to real rates in Phase 3, but B2B keeps free-shipping-over-threshold as a
   commercial choice (threshold TBD).
2. **Invoice counter mechanism**: dedicated `InvoiceCounter` table vs `SELECT FOR UPDATE` on a settings
   row. Recommendation: dedicated table, one row per `(channel, FY)`.
3. **Seller state / warehouse**: single origin (Delhi, `110046` per `DELHIVERY_ORIGIN_PINCODE`) or
   multi-warehouse with per-shipment place-of-supply origin? Assumed single for now.
4. **B2C payment methods**: Razorpay only (needs the flag turned on + go-live), or also expose UPI-manual
   / COD to consumers? COD for consumers materially changes the returns/refund risk.
5. **Consumer identity for ₹50k rule**: collect State+code from all B2C buyers at checkout (simpler,
   consistent) or only when the total approaches ₹50,000?  Recommendation: always collect State
   (needed for place of supply anyway); collect full name/address for the invoice only at ≥ ₹50k.
6. **Phase 6 direction** (6a / 6b / 6c) — decide after Phase 3.
7. **CA / counsel engagement** — book now so the Phase 5 sign-off gate isn't the bottleneck.

---

## 9. Changelog

- **2026-09-08** — Document rewritten from scratch (earlier plan was never committed). Corrections vs.
  the earlier plan and the compliance reference: B2CL threshold ₹2.5 L → **₹1 L** (R10); added the
  **₹50,000 B2C recipient-details rule** (R3); **CGST/SGST/IGST split moved from a Phase 4 stretch to
  Phase 1** (R1/R2/D4); **Aadhaar KYC dropped** in favour of GSTIN + PAN / PAN + Udyam (R7/D2); added
  **Legal Metrology Rule 6(10)** (R4) and **Consumer Protection (E-Commerce) Rules 2020** grievance +
  nodal officer (R5); added **DPDP Act** notice/consent/rights/breach (R8). Decisions D1–D11 locked.
  Turnover confirmed **below ₹5 crore** → e-Invoicing not applicable (D11/R14).
