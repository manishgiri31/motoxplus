# AUDIT / 01 — Phase 1 Findings (read-only, in progress)

Started 2026-08-28. Appended as the audit proceeds. **No code has been changed.**

Reference: `AUDIT/00-map.md`. The repo already contains two prior partial audits —
`docs/delhivery-audit.md` and `docs/delhivery-open-items.md` — which this phase
reconciles against rather than re-deriving (see Area C).

---

## 0. Coverage checklist

Legend: ✅ fully read · 🟡 partially read / key files only · ⬜ not yet

### Priority hypotheses
| H | Status | Verdict |
|---|---|---|
| H1 API bypass of approval/verification | ✅ traced | **Mostly REFUTED** — see below |
| H2 stale shipment status → wrong fee tier | ✅ traced | **CONFIRMED (P0, compounded by H8b)** |
| H3 Razorpay webhook swallows failures | ✅ traced | **CONFIRMED (P1 now / P0 at launch)** |
| H4 Float money model | 🟡 traced core paths | **Minor issues only; no material Razorpay disagreement (gated off)** |
| H5 rate limiting under PM2 cluster | ✅ traced | **REFUTED as configured (REDIS_URL set); latent fail-open risk** |
| H6 migration drift | 🟡 blocked on shadow DB | **CANNOT fully verify — manual diff of `0_init` pending** |
| H7 Shiprocket live/dead | ✅ | **CONFIRMED DEAD (no importers; creds not set)** |
| H8 delhiveryFetch retry + cancel wiring | ✅ | **BOTH CONFIRMED** |

### Areas
| Area | Status | Notes |
|---|---|---|
| A auth/authz — helper modules | ✅ | `auth.ts`, `lib/auth/*`, `middleware.ts`, `staff-access.ts`, `require-admin.ts`, `verified-account.ts`, `identity.ts`, `current-user.ts` all read |
| A route matrix (~146 routes) | ✅ 146/146 | segment 1 (§4b) + segment 2 (§4c, 2026-08-29). All non-uniform routes full-file read; every `route.ts` authz line grep-confirmed. **Area A DONE.** |
| B money | 🟡 | Order-create, Razorpay verify/create, UPI submit, admin verify/reject/retry, cancellation lib read. Refund tiers + GST-on-fee traced. Not read: `payments/upi/qr`, `payments/upi/[orderId]`, invoice generation/PDF. |
| C shipping | ✅ code / 🟡 vs live | `client/shipment/tracking/cancel/webhook/serviceability/rates` read; reconciled with `docs/delhivery-audit.md`. |
| D data layer | 🟡 | §4e done: `Order.status` writers/state-machine (F-24), N+1 (clear in API routes), index gaps (F-25), `decrementStock` atomic-guard confirmed. Owed: H6 manual migration diff, txn sweep (procurement/convert), admin RSC page query cost (Area H). |
| E API surface (validation/errors/rate-limit table) | 🟡 | §4d done: validation coverage (7/~120 use zod → F-22), rate-limit tier table (E-2), error-handling spot notes (E-3). Per-route error-leak pass still owed. |
| F Next.js 15 | ⬜ | not started |
| G Redis | 🟡 | `redis.ts`, `rate-limit.ts` read; cache-invalidation map ⬜ (need to find all `unstable_cache`/`redis.get` cached reads) |
| H web UI | ⬜ | app not yet run |
| I Flutter app | ⬜ | not started |
| J ops & security | 🟡 | secrets-in-history, npm audit, .gitignore done; PM2/health/backup ⬜ |
| K dead weight | 🟡 | Shiprocket, cashfree, import-products confirmed; unused-export sweep ⬜ |

---

## 1. Priority hypothesis results

### H1 — Approval/verification gating bypassable via API — **MOSTLY REFUTED**

**Claim:** `src/middleware.ts` matches page routes only (`matcher` = `/dealer`, `/admin`,
`/vendor`, auth/verification pages — never `/api/*`), and approval is enforced by
middleware *routing*, not at login. A correct password always mints a session
(`src/lib/auth.ts:78-86`), and `POST /api/mobile/auth/login` returns Bearer tokens to any
password-valid user regardless of verification (`mobile/auth/login/route.ts:507-517`). So an
unverified/unapproved dealer does hold a usable session on both auth systems.

**What actually happens on the money/mutation routes:** every state-changing dealer route
calls `getVerifiedDealer(userId)` (`src/lib/auth/verified-account.ts:15-25`), which returns
null unless `isActive && emailVerified && mobileVerified && dealer.status === "ACTIVE"`, and
the route then returns **403 `ACCOUNT_NOT_VERIFIED_MESSAGE`**. Verified on:
- `POST /api/orders` (`orders/route.ts:104`)
- `POST /api/cart` (`cart/route.ts:318`)
- `POST /api/payments/create-order` (`create-order/route.ts:688`)
- `POST /api/payments/verify` (`verify/route.ts:415`)
- `POST /api/payments/upi/submit` (`upi/submit/route.ts:549`)
- `POST /api/upload/dealer-document` (`dealer-document/route.ts` — via `dealer` lookup + role)
- `POST /api/orders/[id]/cancel` — dealer branch is ownership-checked; verification not
  re-checked but a dealer with no confirmable order can't reach a chargeable state.

**Verdict: REFUTED for the critical set.** The `/api/*` middleware gap is real but has been
systematically compensated. The residual exposure is minor:

| Finding | Severity | Where |
|---|---|---|
| `POST /api/upload/payment-screenshot` checks only `role === "DEALER"`, not `getVerifiedDealer` — an unverified dealer can PUT arbitrary (magic-byte-validated) images to R2 under a client-controlled `orderId` path segment (defaults to `"unknown"`) | **P3** | `upload/payment-screenshot/route.ts:78-85` |
| Read-only self-data (`GET /api/cart`, `GET /api/orders/[id]`, `.../tracking`, `.../cancellation-preview`) readable by an unverified dealer for their own rows only | **P3 / informational** | multiple |

**Deliberate Phase-1 deviation:** H1 asked for a failing test. Phase 1's "no code changes"
rule takes precedence; the correct home for it is `scripts/security/idor-cross-account-test.ts`
(which already logs in via both auth systems). Phase 3 should add cases: unverified-dealer
session → `POST /api/orders`, `POST /api/cart`, `POST /api/payments/upi/submit`,
`POST /api/upload/payment-screenshot` — expect 403 on all four (the 4th currently returns 200/500).

---

### H2 — Cancellation fee tier reads stale local status — **CONFIRMED · P0** (compounds with H8b)

**Which field is read:** `evaluateCancellation()` (`src/lib/orders/cancellation.ts:76-116`)
reads **`Order.status`** (the enum), never `Shipment.status`. Stage map
(`cancellation.ts:65-70`): `PENDING|CONFIRMED|PROCESSING → PRE_SHIP` (2%), `SHIPPED → POST_SHIP`
(20%). Both `GET .../cancellation-preview` and `POST .../cancel` use this.

**How `Order.status` becomes `SHIPPED`:** only three ways —
1. an admin manually `PATCH /api/orders/[id]` `PROCESSING → SHIPPED` (`orders/[id]/route.ts:480-485`);
2. a Delhivery webhook whose normalized status is `IN_TRANSIT`/`OUT_FOR_DELIVERY`
   (`src/lib/delhivery/webhook.ts:1018-1025` maps those to `Order.status = SHIPPED`);
3. `syncTrackingToDb` doing the same mapping (`tracking.ts:843-856`) — but that only runs
   when someone opens `GET /api/orders/[id]/tracking` **and** `shipment.updatedAt` is >30 min old
   (`tracking/route.ts:1240-1243`).

**The leak.** An AWB is created the moment an order is `CONFIRMED` — COD at order creation
(`orders/route.ts:254-258`), prepaid at payment finalize (`finalize.ts:346`). The order then
sits at `CONFIRMED`/`PROCESSING` (both **PRE_SHIP / 2%**) while the parcel is physically in
Delhivery's hands, until one of the three transitions above fires. Delhivery's `PICKED_UP`
status maps to `Order.status = PROCESSING` (still PRE_SHIP), so **even after the courier has
collected the parcel** the order reads PRE_SHIP. If the webhook secret isn't configured
(`DELHIVERY_WEBHOOK_SECRET` is `[OPTIONAL]`) and nobody opens the tracking page, `Order.status`
can stay `CONFIRMED`/`PROCESSING` **indefinitely — even past physical delivery.**

During that window a dealer self-cancels:
- fee tier = PRE_SHIP → **2%**, refund **98%** of `amountPaid`;
- `isDealerPostShipBlocked` (`cancellation.ts:165-167`) only blocks `status === "SHIPPED"`, so
  the dealer cancel is **allowed**;
- **nothing calls Delhivery** (H8b) — the real parcel keeps moving and is delivered.

Net: dealer receives the goods **and** gets 98% of their money back. For an admin-initiated
cancel of a genuinely `SHIPPED` order the same "no Delhivery cancel" leak applies (the stopgap
only guards the dealer path).

**Window size:** courier-pickup → `Order.status=SHIPPED` = minutes-to-hours if the webhook is
configured and firing; **unbounded** if it isn't. Not quantifiable further without prod
config + traffic data.

**Verification:** code trace of `cancellation.ts`, `webhook.ts`, `tracking.ts`,
`orders/route.ts`, `finalize.ts`, `cancel/route.ts`; corroborated by the repo's own
`docs/delhivery-open-items.md` item 1 ("a live money/goods leak: refund issued, shipment
still in motion") and `docs/delhivery-audit.md`.

**Fix direction (Phase 2/3, needs product decision):** `cancel`/`preview` must consult the
`Shipment` row (exists? `Shipment.status` past a threshold?) or do a live Delhivery status
fetch, and pick the tier / block accordingly; and `cancelDelhiveryShipment` must be wired in
(Delhivery first, refund only on accept — per `delhivery-open-items.md`).

---

### H3 — Razorpay webhook swallows processing failures — **CONFIRMED · P1 (P0 at launch)**

- `POST /api/webhooks/razorpay` catch block `return NextResponse.json({ ok: false, error:
  "Processing failed" })` → HTTP **200** (`webhooks/razorpay/route.ts:118-123`). Same in
  `webhooks/delhivery/route.ts:64-68`. Razorpay will not retry on a 200.
- `finalizeCapturedPayment` (`src/lib/payments/finalize.ts`) marks the `Payment` row `PAID`
  via `prisma.payment.updateMany(... status:{not:"PAID"} → "PAID")` at **lines 288-295 —
  OUTSIDE and BEFORE the `$transaction` at line 300**. If the transaction then throws (e.g.
  `InsufficientStockError` from `decrementStock` at line 313 — a real possibility, stock can
  sell out between order placement and capture), the transaction rolls back (order NOT
  `CONFIRMED`, no invoice, no shipment) but **`Payment.status` is already committed as `PAID`.**
- On the next webhook delivery, `handlePaymentCaptured` short-circuits at
  `if (dbPayment.status === "PAID") return;` (`webhooks/razorpay/route.ts:141-142`) → permanent
  no-op. The order is stuck `PENDING` with the money captured; the only trace is a
  `console.error` in `verify/route.ts:484` / `finalize.ts:347`. No alert, no queue, no retry.
- The client `POST /api/payments/verify` path at least returns a 409/500 to the dealer, so a
  human notices. The webhook path is fully silent.
- **Idempotency between verify and webhook is otherwise sound:** both funnel through
  `finalizeCapturedPayment`, guarded on `Order.stockReserved: false` (SET not increment for
  `amountPaid`), so no double stock decrement / double invoice / double credit. Confirmed.

Latent today (`NEXT_PUBLIC_RAZORPAY_ENABLED=false`). **P1 as unshipped defect; P0 the day
Razorpay goes live.** Fix direction: move the `Payment→PAID` write inside the transaction;
make the webhook return non-2xx (or enqueue) on a genuine processing failure so Razorpay
retries; add an alert on post-capture finalize failure.

---

### H4 — Float money model — **Minor issues only; no material Razorpay disagreement**

`roundToPaise(x) = Math.round((x + Number.EPSILON) * 100) / 100` (`utils.ts:782-784`), applied
at each step of order creation (`orders/route.ts:139-163,198-199`), cancellation
(`cancellation.ts:135-139`), and finalize (`finalize.ts:305`).

- **Razorpay paise conversion is consistent on both sides:** `create-order` sends
  `Math.round(order.amountDue*100)` and stores `amount: order.amountDue`; `verify` checks
  `captured.amount !== Math.round(payment.amount*100)`; webhook checks the same. Same formula,
  same 2-dp inputs → cannot disagree. (And it's gated off.)
- **Cancellation fee/refund:** `amountPaid` is always a `roundToPaise`d value; `feeAmount =
  round(amountPaid*pct/100)`, `refund = round(amountPaid - feeAmount)` → `fee + refund ==
  amountPaid` exactly for 2-dp inputs. No leak.
- **Real (small) issue — tax invoice internal inconsistency:** `Order.gstAmount` =
  `roundToPaise(Σ unrounded itemGST)` (`orders/route.ts:145-154`), while each `OrderItem.gstAmount`
  = `roundToPaise(unitPrice*qty*gstRate/100)` independently (line 198). On a multi-line order
  the **sum of the per-line GST amounts can differ from `Order.gstAmount` by ₹0.01–₹0.0N**, and
  the invoice/PDF prints the order-level figure. For GST filing the invoice must be internally
  consistent (line items must sum to the header). **P2 (compliance), P3 (money).**
  → Fix direction: derive `Order.gstAmount` as `Σ` of the already-rounded per-line values.
- `calcShipping` uses `Math.round(orderTotal*0.05*100)/100` inline instead of `roundToPaise`
  (`orders/route.ts:13-16`) — functionally equivalent here, style nit. P3.

---

### H5 — Rate limiting under PM2 cluster — **REFUTED as configured**

- `REDIS_URL` **is set** in the server `.env` (confirmed — key present). Every app rate limit
  goes through `checkRateLimit()` (`rate-limit.ts:137-161`), which uses the Redis Lua
  INCR+EXPIRE script when `getRedis()` is non-null → **shared across all PM2 workers.**
- Cluster-safe backstops that don't depend on Redis at all:
  - DB account lockout: `User.failedLoginAttempts` column, 5 → 30-min `accountLockedUntil`
    (`rate-limit.ts:10-30`).
  - OTP attempt cap: `OtpCode.attempts` column, `MAX_OTP_ATTEMPTS = 5` (`otp.ts:488-500`),
    claimed via guarded `updateMany(used:false)`.
  - OTP resend cap: `checkResendLimit` counts `OtpCode` rows in the last hour, ≤ 10 per user
    (`otp.ts:511-523`) — bounds SMS/WhatsApp spend per account regardless of Redis.
- **Residual (P3):** the coarse per-IP / per-identifier budgets are `failMode: "open"` for
  LOGIN/OTP/ORDER classes (`rate-limit-budgets.ts:259-314`). If Redis is unreachable they
  silently fall back to the per-worker in-memory `Map` (`rate-limit.ts:144-147,158-159`), so
  the *effective* coarse limit is `budget × core count` during an outage. The DB backstops
  above keep login brute-force and OTP spend bounded, so this is a weakening, not a hole.
- `POST /api/payments/upi/submit` still uses the **older** `checkIPRateLimit(ip, 5, 60)`
  (`upi/submit/route.ts:513-516`) — fail-open, per-IP only, **no DB backstop**. Under a Redis
  outage that's `5 × cores` submissions/60s/IP. Low impact (admin reviews each). P3.

---

### H6 — Migration drift — **CANNOT fully verify (blocked); manual diff pending**

`npx prisma migrate diff --from-migrations … --to-schema-datamodel …` needs a shadow database;
the configured datasource is a real Postgres that denied `CREATEDB` (`P1010`), and I will not
connect this audit to the production database. A **manual** line-by-line diff of
`prisma/migrations/0_init/migration.sql` (1674 lines) + the 4 later migrations against
`schema.prisma` is feasible and is the next task on resume.

Prima facie suspects from map §3 (schema fields with no obvious owning migration): `Vehicle.aiLabels`,
`Vehicle.ocrKeywords`, `Vehicle.badgeText`, `Product.package{Length,Width,Height,Weight}`,
`Product.markupPercent/mrp/vendorCostPrice/oemNumber`, `ProductImage.{mediumUrl,thumbnailUrl,mimeType,fileName,fileSize,key}`,
`ProductVariant.{partNumber,finish,moq,size,sku,vehicleModel}`, `User.last{Device,LoginIP}`.
If any of these live only in `schema.prisma` (arrived via `prisma db push`), then
`scripts/db/restore.sh` + `prisma migrate deploy` **cannot rebuild current prod schema** and
`DISASTER_RECOVERY.md` is wrong → **P0**. Unconfirmed until the manual diff is done.

---

### H7 — Shiprocket — **CONFIRMED DEAD**

`grep` for `lib/shiprocket` importers outside `src/lib/shiprocket/` → **zero**. The repo's own
`docs/delhivery-audit.md` §2 says the same ("zero import references anywhere outside its own
directory … not wired to a single route"). `SHIPROCKET_EMAIL` / `SHIPROCKET_PASSWORD` are
`[OPTIONAL]` and **not present** in the server `.env` → no live credential liability today.
It's ~400 LOC of dead code (auth, token cache in Redis, 401-retry, redaction, 2 test files).
**P3 — delete in Phase 3 (Area K).** If it's ever wanted, revive from git.

---

### H8 — The two known bugs — **BOTH CONFIRMED**

**H8a — `delhiveryFetch` retry can duplicate a shipment.** `delhiveryPost()`
(`client.ts:74-84`) calls `delhiveryFetch()` with no `retries` override → inherits
`MAX_RETRIES = 3` (`client.ts:3`). The retry loop (`client.ts:33-60`) retries on any thrown
error (network/timeout via `AbortSignal.timeout(15000)`) and on any non-`ok`, non-401
response, with exponential backoff — **no path/method exclusion for `POST /api/cmu/create.json`.**
`createDelhiveryShipment` (`shipment.ts:93+`) sends `create.json` through this. Delhivery can
accept attempt 1 and still have the client time out → attempt 2 creates a **second real AWB**.
Flagged three times in the repo's own docs (`delhivery-audit.md`, `delhivery-open-items.md`
item 2) and never fixed. The DB `Shipment.orderId @unique` only stops the second *row* — after
both calls have already hit Delhivery. A concurrent-call variant (webhook retry vs admin click,
two `finalize` calls) has the same outcome and no lock (`delhivery-audit.md` "HIGH —
double-manifest race").

**H8b — `cancelDelhiveryShipment` is not wired to anything.** `grep`: referenced only by
`src/lib/delhivery/cancel.test.ts` and re-exported by `index.ts`. `POST /api/orders/[id]/cancel`
does **not** import it (`cancel/route.ts` imports `refundPayment`, `restockItems`,
`evaluateCancellation`, … — not `cancelDelhiveryShipment`). The function's own header comment
(`cancel.ts:975-977`) and `delhivery-open-items.md` item 1 both state this explicitly. This is
the other half of the H2 P0.

---

## 2. Confirmed findings (this session)

| ID | Sev | Area | Location | What's wrong | Manifestation for a dealer | Verified by |
|---|---|---|---|---|---|---|
| F-01 | **P0** | J | git history (`d2bdf8b`..`096671d`, 2026-06-17→20) | Production `.env` was committed for 6 commits: `DATABASE_URL` (Neon, w/ password), `NEXTAUTH_SECRET`, `JWT_SECRET`, `RAZORPAY_KEY_SECRET`, `R2_SECRET_ACCESS_KEY`, `DELHIVERY_API_TOKEN`, `DELHIVERY_WEBHOOK_SECRET`, `RESEND_API_KEY`, `MSG91_AUTH_KEY`. `SECRET-ROTATION.md` (added 2026-08-13) is a full runbook but its checklist items are unchecked; **no evidence rotation was executed.** | Anyone with a repo clone/fork has (or had) full production credentials — DB, session-signing, payments, storage, shipping, SMS. | `git show <c>:.env`; `git log -- .env`; read of `SECRET-ROTATION.md` |
| F-02 | **P0** | C/B | `src/lib/orders/cancellation.ts:76-116,165-167` + `webhook.ts` + `tracking.ts` + `cancel/route.ts` | Cancellation fee tier keys off `Order.status`, which lags real shipment state (often indefinitely). Dealer cancels a physically-in-transit `PROCESSING` order at 2% (98% refund) and, per H8b, the parcel is never cancelled with Delhivery. | Dealer keeps the goods and gets 98% of the money back. | code trace + `docs/delhivery-open-items.md` item 1 |
| F-03 | **P0** | C | `src/lib/delhivery/client.ts:3,33-60,74-84` | `create.json` inherits 3 auto-retries; Delhivery may accept attempt 1 before a client timeout → duplicate real AWB. No path/method exclusion; no advisory lock for the concurrent-call variant. | Two parcels dispatched and billed for one order; the second is invisible to the app. | code trace + `delhivery-audit.md` / `delhivery-open-items.md` (flagged 3×) |
| F-04 | **P0** | C/B | `src/app/api/orders/[id]/cancel/route.ts` (whole flow) | `cancelDelhiveryShipment` exists but is called nowhere. Any cancellation of an order that has an AWB (dealer *or* admin) issues a refund and leaves the parcel moving. | Refund + goods, every post-manifest cancellation. | `grep`; function header comment; `delhivery-open-items.md` item 1 |
| F-05 | **P1** — **THE Razorpay go-live blocker; fix before anything else on that integration** | B | `src/lib/payments/finalize.ts:41-48` (the `prisma.payment.updateMany(... → "PAID")` **before** the `$transaction` at :52) | `Payment→PAID` write is outside the `$transaction`; if the txn throws, Payment is `PAID` but order stays `PENDING`, and every later webhook delivery no-ops on `dbPayment.status==="PAID"` (`webhooks/razorpay/route.ts`). Webhook returns 200 on processing error → no Razorpay retry. **Concrete trigger confirmed 2026-08-29:** prepaid orders do NOT reserve/decrement stock at creation (`orders/route.ts:184` `stockReserved: isCOD` — so `false` for every prepaid order), so two dealers can both check out the last unit, both pay, and the 2nd dealer's `finalize` hits `decrementStock`'s atomic `stock:{gte:qty}` guard → `InsufficientStockError` thrown from inside the txn *after* their Payment row is already committed `PAID`. **Money captured, no order, no retry, no alert.** Not a corner case — any oversold SKU during a busy window. | (Razorpay live) 2nd dealer's money captured, order never confirmed, permanently stuck, silent — only a `console.error`. Fix: (1) move the `Payment→PAID` write inside the `$transaction`; (2) reserve stock at prepaid order creation, or accept the oversell and refund cleanly; (3) webhook returns non-2xx / enqueues on genuine processing failure; (4) alert on post-capture finalize failure. | code trace (`finalize.ts`, `stock.ts`, `orders/route.ts`) |
| F-06 | **P2** | A | `src/app/api/admin/payments/[id]/verify/route.ts:11,16` (also `review`, `reject`) | `ADMIN_ROLES` here is `["ADMIN","SUPER_ADMIN","STAFF"]` with **no department check** — any STAFF (SALES, MARKETING, PRODUCTION) can verify/reject dealer payments and confirm orders. `staff-access.ts` scopes invoices/accounts work to `ACCOUNTS` dept, but this route doesn't use `requireSectionAccess`. | A marketing staffer can mark any dealer's payment verified → order goes to production with no money received. | code trace; contrast with `staff-access.ts:6-13` |
| F-07 | **P2** | B | `src/app/api/admin/refunds/[id]/retry/route.ts:263-283` | `refundStatus !== "FAILED"` is a read-then-write check with no atomic guard; two concurrent retries both pass and both call `refundPayment` (Razorpay refund API, no idempotency key). | Double refund issued to the dealer on a double-click / concurrent admin action. | code trace |
| F-08 | **P2** | J | `npm audit` (10 vulns: 2 critical, 7 high, 1 low) | `xlsx@0.18.5` prototype pollution (CVSS 7.8, admin import path, no npm-registry fix available); `@auth/core` homoglyph email bypass (critical, via next-auth chain); `next`→`postcss` XSS; `sharp`/libvips CVEs; `deepmerge-ts` DoS via `@prisma/config`. | `xlsx`: an admin importing a crafted `.xlsx` could pollute `Object.prototype` in the Node process. Others mostly build-time / low-reachability. | `npm audit --json` |
| F-09 | **P3** | J | `.gitignore` | File contains 6 NUL bytes, detected as binary `data` (705 bytes). Git currently parses it (`check-ignore` works) but it's corrupted — likely a PowerShell UTF-16 redirect. Fragile. | A future edit by a tool that respects the BOM could silently drop ignore rules → re-committing `.env`/`node_modules`. | `file .gitignore`; `python` byte count |
| F-10 | **P3** | K | `src/lib/shiprocket/*` | ~400 LOC dead integration, no importers, creds unset. | none (dead) | `grep`; `delhivery-audit.md` §2 |
| F-11 | **P3** | H4/B | `src/app/api/orders/route.ts:145-154` vs `:198` | `Order.gstAmount` (sum-then-round) can differ from `Σ OrderItem.gstAmount` (round-then-sum) by a few paise on multi-line orders; the invoice prints the header figure. | Tax invoice line items don't foot to the header GST total — a GST-compliance defect on B2B invoices. | code trace |
| F-12 | **P3** | A | `src/app/api/upload/payment-screenshot/route.ts:78-85` | Only `role === "DEALER"` checked (not `getVerifiedDealer`); `orderId` from form data is unvalidated and used in the R2 key path (defaults `"unknown"`). | An unverified dealer can write images to storage; `payments/upi/submit` then accepts an arbitrary client-supplied `screenshotUrl`/`screenshotKey`. | code trace |
| F-13 | **P3** | E | many list routes, e.g. `orders/route.ts:28`, `admin/shipments/route.ts:673` | `parseInt(searchParams.get("page")||"1")` with no NaN/`<1` guard → `skip: (page-1)*pageSize` can be negative or `NaN` (Prisma throws → unhandled 500). | `?page=0` or `?page=x` on a list endpoint → 500. | code trace |
| F-14 | **P2** | A | `src/lib/auth/session.ts:85-90` (`revokeAllSessions`); `src/middleware.ts:76-84`; `src/lib/auth/current-user.ts`; `src/lib/auth/middleware.ts:5-11` | Session revocation is incomplete. (a) NextAuth JWT sessions are stateless (8 h `maxAge`, `auth.ts:30`) and have **no `UserSession` cross-check** — `revokeAllSessions` / `admin/users/[id]/disable` / `reset-password` / `logout-all` don't invalidate them; middleware's `authorized` is just `!!token`. (b) `getCurrentUserId`/`getAuthUser` (every dealer/mobile API route) **never check `UserSession.isActive`** — only `requireAuth` does (used by just 3 routes). | A disabled or just-password-reset dealer keeps full web portal + API access for up to 8 h (web) / 15 min (mobile access token). `disable`'s "sessions revoked" message is false for the web session. | code trace |
| F-15 | **P2** | A | `src/app/api/auth/change-email/route.ts:483-505` | Account email can be changed with only a valid session + `checkIPRateLimit(5,60)` — no password/OTP step-up. `user.email` is updated immediately; verification OTP goes to the new (attacker-controlled) address. | A hijacked session → change email → verify → `forgot-password` to that email → full account takeover. | code trace |
| F-16 | **P3** | A/E | `src/app/api/auth/verify-email/route.ts` | Unauthenticated, takes `userId` from body, and has **no IP or identifier rate limit** (only the per-code 5-attempt cap in `verifyOTP`). Every sibling verify route uses `enforceRateLimit`/`checkIPRateLimit`. | Low practical risk (can't mint new codes without the IP-limited send route) but an unbounded guessing surface and an inconsistency. | code trace |
| F-17 | **P2** | C | `src/lib/delhivery/types.ts:328-350` (`normalizeShipmentStatus` / `DELHIVERY_STATUS_MAP`); consumers `webhook.ts:5-12,26,60-65` and `tracking.ts:43` → `syncTrackingToDb` `tracking.ts:108,117-129` | `normalizeShipmentStatus` has **no mapping for raw Delhivery `"Not Picked"`** (the pre-pickup / pre-pickup-cancelled state, confirmed via live capture — `delhivery-open-items.md` item 3). It falls through to the `IN_TRANSIT` default. Both consumers then write `Shipment.status = IN_TRANSIT` **and** transition `Order.status → SHIPPED` for a parcel the courier has not collected. Complete consumer list: only `webhook.ts:26` and `tracking.ts:43` call it; `fetchLiveTracking` feeds `syncTrackingToDb` (writes) and `GET /api/orders/[id]/tracking:56` (display only). | On the first tracking-page open >30 min after manifest (`tracking/route.ts:44-48`), a pre-pickup order flips to `SHIPPED` → dealer self-cancel blocked (`isDealerPostShipBlocked`) and cancellation quoted at POST_SHIP **20%** instead of PRE_SHIP 2%. Over-charge / over-block — the mirror of F-02's under-charge. Same via the (dormant) webhook once `DELHIVERY_WEBHOOK_SECRET` is configured. | code trace + `docs/delhivery-open-items.md` item 3 + `src/lib/delhivery/tracking.test.ts:207-210` |

> **F-17 handling in the emergency batch:** the `normalizeShipmentStatus` gap itself is deliberately **not** fixed (blast radius — mapping `"Not Picked"` → `MANIFESTED` changes `Order.status` transitions in webhook + tracking-sync, outside the batch's F-02/F-04 tier scope; left for **Phase 3** / the Phase 5 DB-driven `delhivery_status_map` redesign). Instead:
> - **Item 1c (shipped):** `syncTrackingToDb` now guards the `Order.status → SHIPPED` write with `isPreShipCarrierStatus()` against the RAW carrier fields — a "Not Picked"/manifested parcel no longer records a false `SHIPPED`. Narrow: `Shipment.status`, `normalizeShipmentStatus`, `ORDER_STATUS_MAP` and the webhook are untouched. The webhook path still has the F-17 bug (dormant — `DELHIVERY_WEBHOOK_SECRET` unset); Phase 3.
> - The cancellation tier decision (dealer + admin) uses a **read-only carrier classifier** (`classifyCarrierTier`), never the normalizer or `Order.status`.

| F-18 | **P2 (a) / P3 (b)** | A | (a) `src/lib/auth.ts:125-139` (`session` callback), `src/middleware.ts`; (b) `src/lib/auth.ts:27-32` + no web caller of `/api/auth/refresh` | Split finding, both about the web (NextAuth-cookie) session, which the F-14 batch fix (Option 1) does **not** cover. **(a) No `UserSession` cross-check on the web branch:** `getCurrentUserId` for a web dealer past the 15-min `mx_access` window resolves via `getServerSession`, and the `session` callback never copies `token.sessionId` onto `session.user`, so `UserSession.isActive` can't be checked there. `revokeAllSessions` (disable / logout-all / both reset-password routes) therefore leaves the web session live for up to the NextAuth `maxAge`. Closing it needs the `session`-callback change (+ next-auth type aug) and touches every `getServerSession` call site → out of batch scope (DECISION-RULES §3, "could take the portal down"). **(b) Web session lifetime is effectively unbounded:** `updateAge: 3600` rolls the 8 h JWT forward on every request, the web client never calls `/api/auth/refresh`, so `rotateSession()` never runs for a web session and `UserSession.expiresAt` (login + 7 d) is decorative on web — a daily-active dealer's session never ends. Independent of revocation. Also: `mx_access` expires at 15 min and is never renewed on web, `mx_refresh` is never used — the custom-JWT machinery is half-wired on the web path; Phase 3 decides wire-up vs. removal. | (a) disabled/reset web dealer keeps portal + `getServerSession`-gated API access until the NextAuth cookie's `maxAge`; (b) sessions never expire by time on the web. | code trace; F-14 blast-radius report (this session) |

**Interim mitigation for F-14a (shipped this batch):** `SECRET-ROTATION.md` now documents rotating `NEXTAUTH_SECRET` as the break-glass for an urgent web disable (invalidates every web session immediately), and `admin/users/[id]/disable` carries a code comment that its "sessions revoked" message is accurate for Bearer/mobile clients only until F-18 lands.

---

## 3. Suspected findings (need more tracing before rating)

- **S-01 (B):** `admin/payments/[id]/verify` invoice creation guards on the *stale*
  `submission.order.invoice` read; two concurrent verifies → second txn hits
  `Invoice.orderId @unique` P2002 and rolls back the whole txn, returning an unhandled 500
  (only `InsufficientStockError` is caught). Also a dealer submitting two UTRs for one order,
  both verified, produces a 500 on the second. Likely P3.
- **S-02 (A):** `admin/payments/[id]/review` / `reject` call `prisma.paymentSubmission.update({where:{id}})`
  with no existence check → P2025 unhandled 500 on a bad id. `review` has no state-machine
  guard (can move `VERIFIED`→`UNDER_REVIEW`). P3.
- **S-03 (A):** `GET /api/orders` returns 401 for any non-DEALER/non-ADMIN role — STAFF with
  "orders" section access can open `/admin/orders` (page) but the list API refuses them.
  Possible broken admin-staff flow. Needs the page checked in Area H.
- **S-04 (D):** `orders/route.ts` deletes the cart with `prisma.cartItem.deleteMany` **after**
  the `$transaction` commits (line 251), not inside it. If that delete fails, the order exists
  but the cart isn't cleared → next checkout duplicates the order. Low probability, P3.
- **S-05 (E/security):** `send-mobile-otp` per-identifier rate-limit key is the *target* mobile
  number; an attacker rotating target numbers gets a fresh 10/15-min bucket each time, leaving
  per-IP (8/60s) as the only cross-number bound — *but* `checkResendLimit` caps a single
  authenticated user to 10 OTP/hour total. Net spend bound per account ≈ 10/hr. Likely P3.
- **S-06 (D): PROMOTED → F-24** (2026-08-29, after the state-machine enumeration in §4e D-1).
- **S-07 (J):** Brief says "Hostinger VPS PostgreSQL"; git history (`df12334 connect neon db`)
  and the leaked `DATABASE_URL` shape suggest **Neon**. Affects backup/restore assumptions.
  Needs confirmation from the team / current `.env` value (not read).
- **S-08 (A):** `procurement/*` routes (requests, purchase-orders, grn) all require
  `["ADMIN","SUPER_ADMIN"]`, but `staff-access.ts` maps `procurement/grn → ["PRODUCTION"]` and
  `STAFF_NAV.PRODUCTION` renders a "GRN" link. PRODUCTION staff get a nav link to a page whose
  API 401s them. Same family as S-03 / O-1. Confirm in Area H (page-level guard may also 401,
  in which case it's just a dead nav link, not a broken flow). P3.
- **S-09 (F/J):** `npm run build` prerenders `/admin/staff` and `/admin/products/new` (and
  reached 111/148 before failing), which call `prisma.user.findMany` / `prisma.category.findMany`
  **at build time** → the build hard-fails without a reachable DB, and on success bakes those
  admin pages with build-time data. Admin pages should be `dynamic`/`force-dynamic` or use
  client-side fetch. Confirm the full list of DB-touching prerendered pages in Area F/H. P2
  (build fragility + stale admin data).
- **S-10 (K/process):** the uncommitted push-notification WIP (working tree, 2026-08-29) ships
  with **2 failing tests** — it added `include:{order:{select:{status:true}}}` +
  `shipment.order.status` to `syncTrackingToDb` without updating `tracking.test.ts`'s mock. Also
  it introduces a *third* `notifyOrderEvent`-at-status-transition site and a `NOTIFY_EVENT_BY_
  ORDER_STATUS` map in **both** `webhook.ts` and `tracking.ts` — i.e. it's building more on top
  of the F-24 unguarded-writer problem. Flag before it's committed. P3 (process); the F-24
  interaction is already P1.

---

## 4. Cannot verify without more access

| Item | What's needed |
|---|---|
| H6 full drift check | A throwaway Postgres shadow DB (or `prisma migrate diff` output from a machine with CREATEDB). Manual SQL-vs-schema diff is the fallback and is queued. |
| Whether F-01 secrets were actually rotated | Confirmation from the team, or dashboard access (Razorpay/R2/Resend/Delhivery/Neon key-creation timestamps). |
| Whether `DELHIVERY_WEBHOOK_SECRET` is set in prod (governs how wide the F-02 window is) | Production env; `.env` here has `DELHIVERY_WEBHOOK_SECRET` **unset** but this file may not mirror prod. |
| Whether the Delhivery token actually works (`client.ts` historically read `DELHIVERY_API_TOKEN`; `.env`/config now use `DELHIVERY_TOKEN`) | A live Delhivery call / prod logs. `config.ts` validates `DELHIVERY_TOKEN` at boot, and boot succeeds in prod, so likely fine now — but `delhivery-audit.md` "CRITICAL (to verify)" flagged this. |
| Real N+1 / query-plan cost | `EXPLAIN ANALYZE` against prod-scale data. |
| CI actually runs no tests | Confirmed from workflow files in Phase 0 (`deploy.yml` builds, doesn't test) — treat as confirmed unless a `.github` change lands. |

---

## 4b. Route matrix — segment 1 (auth + core commerce + uploads), ~40 of ~146

Auth accepted: **NA** = NextAuth cookie via `getServerSession`; **JWT** = custom Bearer/`mx_access`
via `getAuthUser`; **both** = `getCurrentUserId`; **requireAuth** = custom JWT *and* `UserSession.isActive`
check; **none** = unauthenticated.

| Route | Method | Auth | Role check | Ownership | Verified/approved acct? | Rate limited |
|---|---|---|---|---|---|---|
| `auth/[...nextauth]` | GET/POST | none→NA | — | — | no (by design) | via `credentials.ts` (LOGIN budget + DB lockout) |
| `auth/register` | POST | none | forces `DEALER` | — | n/a | `checkIPRateLimit(5,60)` |
| `auth/login` | POST | none | — | — | flags only | `credentials.ts` LOGIN + DB lockout |
| `auth/login-otp` | POST | none | — | — | `isActive` checked post-OTP; generic pre-OTP | `OTP_SEND`/`OTP_SEND_EMAIL`/`OTP_VERIFY` + `checkResendLimit` |
| `auth/refresh` | POST | cookie refresh | — | `rotateSession` checks `isActive`+expiry | — | none (token-bound) |
| `auth/logout` | POST | requireAuth | — | own session | — | none |
| `auth/logout-all` | POST | requireAuth | — | own userId | — | none |
| `auth/me` | GET | requireAuth | — | self | — | none |
| `auth/sessions` | GET/DELETE | requireAuth | — | DELETE verifies `session.userId === caller` | — | none |
| `auth/send-mobile-otp` | POST | both | — | self (`userId`) | — | `OTP_SEND` (per target mobile) + `checkResendLimit` |
| `auth/verify-mobile` | POST | both | — | self | — | `OTP_VERIFY` (per userId) |
| `auth/send-email-verification` | POST | none | — | — | generic response | `checkIPRateLimit(5,60)` + `checkResendLimit` |
| `auth/verify-email` | POST | none | — | `userId` from body | — | **none** (F-16) |
| `auth/change-email` | POST | both | — | self | — | `checkIPRateLimit(5,60)`; **no step-up (F-15)** |
| `auth/forgot-password` | POST | none | — | — | generic (`opaqueFlowId`) | `OTP_SEND`/`OTP_SEND_EMAIL` + `checkResendLimit` |
| `auth/verify-forgot-password-otp` | POST | none | — | `userId` from body | — | `OTP_VERIFY` (per userId) |
| `auth/reset-password` | POST | none | — | resetToken (32B) scoped to `userId` | — | `PASSWORD_RESET`; revokes `UserSession` only (F-14) |
| `mobile/auth/login` | POST | none | — | — | flags only | `credentials.ts` LOGIN + DB lockout |
| `mobile/auth/refresh` | POST | body refresh | — | `rotateSession` checks `isActive` | — | none |
| `mobile/auth/me` | GET | JWT (no session check) | — | self | — | none — **no `UserSession` check (F-14b)** |
| `orders` | GET | both | DEALER→own; ADMIN/SUPER→all; else 401 (STAFF gap S-03) | dealer-scoped | — (GET) | none on GET |
| `orders` | POST | both | `DEALER` | own dealer | **`getVerifiedDealer`** ✅ | `ORDER_CREATE` + `rejectOversizedBody` |
| `orders/[id]` | GET | both | DEALER→own; else `requireSectionAccess("orders")` | ✅ | — | none |
| `orders/[id]` | PATCH | NA | `["ADMIN","SUPER_ADMIN"]` | — | — | none; state-machine guarded |
| `orders/[id]/cancel` | POST | both | DEALER→own; else `["ADMIN","SUPER_ADMIN","ACCOUNTS"]` | ✅ | not re-checked (dealer) | `ORDER_CANCEL` + oversize |
| `orders/[id]/cancellation-preview` | GET | both | DEALER→own; else `["ADMIN","SUPER_ADMIN","ACCOUNTS"]` | ✅ | — | none |
| `orders/[id]/tracking` | GET | both | DEALER→own; else `requireSectionAccess("orders")` | ✅ | — | none |
| `cart` | GET/POST/DELETE | both | `DEALER` | ✅ (deleteMany scoped to own cart) | POST via `getVerifiedDealer` ✅; GET/DELETE bare | none |
| `payments/create-order` | POST | both | `DEALER` | own order | `getVerifiedDealer` ✅ | flag-gated off |
| `payments/verify` | POST | both | `DEALER` | own order + Payment-row replay guard | `getVerifiedDealer` ✅ | flag-gated off |
| `payments/upi/submit` | POST | both | `DEALER` | own order | `getVerifiedDealer` ✅ | `checkIPRateLimit(5,60)` (F-05 residual) |
| `upload` (product image) | POST | NA | `["ADMIN","SUPER_ADMIN"]` | — | — | none |
| `upload/[id]` | DELETE | NA | `["ADMIN","SUPER_ADMIN"]` | — | — | none |
| `upload/payment-screenshot` | POST | both | `DEALER` only (not verified — F-12) | `orderId` unvalidated | ❌ | none |
| `upload/dealer-document` | POST | both | `DEALER` | own dealer | dealer lookup (not full verify) | none |
| `files/[id]` | GET | both | ProductImage→admin; DealerDoc→owner/admin | ✅ | — | none |
| `files/signed/[id]` | GET | both | DealerDoc→owner/admin | ✅ | — | none |
| `admin/shipments` | GET/POST | NA | `["ADMIN","SUPER_ADMIN"]` | — | — | none |
| `admin/payments/[id]/verify` | POST | NA | `["ADMIN","SUPER_ADMIN","STAFF"]` — **no dept check (F-06)** | — | — | none |
| `admin/payments/[id]/review` | POST | NA | same as above | — | — | none; no existence/state guard (S-02) |
| `admin/payments/[id]/reject` | POST | NA | same as above | — | — | none |
| `admin/refunds/[id]/retry` | POST | NA | `["ADMIN","SUPER_ADMIN","ACCOUNTS"]` | — | — | none; concurrent double-refund (F-07) |

---

## 4c. Route matrix — segment 2 (admin / vendor / procurement / CRM / catalogue / misc) — 2026-08-29

Completes Area A. Traced by full-file read of the non-uniform routes and a grep sweep of the
auth/authz line of **every** `route.ts` (all ~146). Segment-1 conventions apply.

### Auth-pattern groups (uniform — spot-read + grep-confirmed)

| Group | Routes | Guard | Notes |
|---|---|---|---|
| Vehicle CMS | `admin/vehicles/**` (manufacturers, colors, generations, variants, sections, diagrams+hotspots, gallery, faqs, spins, models-3d, recommendations, accessories, vin-patterns, detection-log, options), `admin/vehicle-types/**`, `admin/reviews/**`, `admin/products/[id]/compatibility/**` | `requireAdmin()` = `["ADMIN","SUPER_ADMIN"]` (`src/lib/auth/require-admin.ts`) | ~45 routes. Consistent. No STAFF path. No ownership concept (global catalogue). Input validation is ad-hoc per route (mostly `await req.json()` destructure, no zod) — fold into Area E. |
| Admin products (non-CMS) | `admin/products/{import,import/template,consolidate,auto-groups,model-images}`, `admin/products/[id]/variants/**`, `products/[id]` PATCH/DELETE, `products` POST, `categories` POST | inline `["ADMIN","SUPER_ADMIN"]` (some via local `requireAdmin()` copies) | `products` POST / `vendor/products` are the only zod-validated writes in the catalogue surface. |
| Admin misc | `admin/dealers/**`, `admin/users/[id]/**`, `admin/settings/**`, `admin/stats`, `admin/shipments`, `admins/**` (SUPER_ADMIN via `isSuperAdmin`) | inline `["ADMIN","SUPER_ADMIN"]`; `admin/settings/verification` POST correctly tightens to `SUPER_ADMIN` | `admin/settings/upi` writes the UPI VPA that dealers pay into — admin-only, no 4-eyes. Logged as observation O-3. |
| Procurement | `procurement/{requests,requests/[id],purchase-orders,purchase-orders/[id],grn}` | local `ADMIN_ROLES = ["ADMIN","SUPER_ADMIN"]` | **No PRODUCTION/STAFF access** though `staff-access.ts` maps `procurement/grn → ["PRODUCTION"]`. Nav-vs-API mismatch → **S-08**. |
| Vendor admin | `vendors`, `vendors/[id]`, `vendors/[id]/{status,contacts,payments,ratings,gst-verify}` | local `ADMIN_ROLES = ["ADMIN","SUPER_ADMIN"]` | `vendors/[id]/payments` (records money paid to a vendor) is ADMIN-only — no ACCOUNTS, unlike `admin/refunds/[id]/retry` which allows ACCOUNTS. Minor inconsistency O-4. |
| CRM | `crm/leads`, `crm/leads/[id]`, `crm/leads/[id]/{activities,notes}`, `crm/stats` | `requireSectionAccess(role, dept, "crm")` → ADMIN/SUPER_ADMIN or STAFF∈{SALES,MARKETING} | Consistent. |
| Vendor self-service | `vendor/profile` GET, `vendor/products` GET/POST, `vendor/purchase-orders` GET, `vendor/purchase-orders/[id]/{accept,reject}` | `role === "VENDOR"` + `vendor.findUnique({userId})` | `vendor/products` POST **does** gate `vendor.status === "APPROVED"` (403) and sets `Product.isActive = false` → **map §D2 vendor-injection concern REFUTED.** `accept/reject` are `vendorId`-scoped + state-guarded (`status === "SENT"`); a SUSPENDED/BLACKLISTED vendor can still accept a PO it was sent (low impact, O-5). |
| Public / unauthenticated | `products/search` GET, `shipping/serviceability` GET, `vehicles` GET (IP-limited 60/60), `categories` GET, `products` GET, `products/[id]` GET, `contact` POST (IP-limited 5/60), `auth/*` unauth set (segment 1) | none | `products/search` and `shipping/serviceability` have **no rate limit** → **F-19, F-20**. |

### New findings from segment 2

| ID | Sev | Area | Location | What's wrong | Manifestation | Verified by |
|---|---|---|---|---|---|---|
| F-19 | **P3** | E/C | `src/app/api/shipping/serviceability/route.ts` (whole file — 12 lines) | `GET /api/shipping/serviceability?pincode=` is **unauthenticated and unrate-limited**, and calls `checkServiceability()` → a live Delhivery API request per hit. **Confirmed no cache** (`src/lib/delhivery/serviceability.ts` — direct `delhiveryFetch`, no memo/Redis/TTL), and `delhiveryFetch` default `retries=3` with 1s/2s backoff → one abusive request can be **3 outbound Delhivery calls** and hold the handler ~3s. Sibling `shipping/estimate` requires `getCurrentUserId`. | Anon caller drives unbounded (×3-amplified) outbound calls to Delhivery — quota burn / carrier-side IP ban that would break real shipment creation — and enumerates serviceable pincodes. | file read (route + `serviceability.ts` + `client.ts`) |
| F-20 | **P3** | E/D | `src/app/api/products/search/route.ts` | `GET /api/products/search?q=` is unauthenticated + unrate-limited and, per request, runs a Prisma `contains` OR-scan **plus** a `$queryRaw` doing `EXISTS (SELECT 1 FROM unnest(p.compatibility) WHERE compat ILIKE '%q%')` — a full scan of the `Product.compatibility` text[] on every ≥2-char keystroke (no GIN index; `Product` has no text-search index). `${pattern}` is parameterised (no SQLi). | Cheap unauthenticated DB-CPU amplification on a keystroke-frequency endpoint. | file read |
| F-21 | **P1** (was P2 — raised 2026-08-29 per user: for a prepaid order it's money taken for an undeliverable order with zero alert to anyone) | C/E | `src/app/api/orders/route.ts:98-101,252-257` + `src/lib/delhivery/shipment.ts` (no serviceability call) | **No server-side pincode-serviceability validation anywhere in the order → manifest path.** `POST /api/orders` validates only `/^\d{6}$/` on `deliveryPincode`. The checkout page's `<PincodeChecker>` is client-side + advisory (and `checkout/page.tsx:210` deliberately decouples shipping cost from it). `createDelhiveryShipment` (contrary to its own doc-comment "createShipment() will call this to re-check serviceability") **never calls `isServiceable`**. COD shipment creation is fire-and-forget with only `console.error` on failure (`orders/route.ts:254`); the prepaid path is the same in `finalize.ts:99`. | Dealer in a non-serviceable pincode places and pays → order `CONFIRMED`, stock decremented, invoice issued, **AWB creation fails silently**, no shipment row, no retry, no alert. For a prepaid order: money captured for something that can never ship, and nobody — dealer, admin, ops — is told. **Fix has two independent parts, both required:** (1) a real serviceability check *before* payment (server-side in `POST /api/orders`, and gate `payments/create-order`/checkout on it); (2) AWB-creation failure must surface somewhere a human sees — an admin queue / OrderEvent / alert — not `console.error`. Part 2 also covers F-05's silent-failure class and every other `createDelhiveryShipment().catch(console.error)`. | code trace (`orders/route.ts`, `shipment.ts`, `finalize.ts`, `serviceability.ts`, `checkout/page.tsx`) |
| ~~F-22~~ → **PHASE 3 WORKSTREAM, not a finding** (reclassified 2026-08-29 per user) | — | E | ~90 route handlers (full list-method in §4d E-1) | Systemic: no input-validation layer. ~90 mutating routes destructure `await req.json()` with no zod schema, no try/catch, no type/range/length/enum checks. Malformed body → unhandled 500 (not 400); out-of-domain but in-type values pass straight to Prisma; Prisma `P2025` on bad id → 500 not 404. F-13 (`parseInt(page)` NaN) is the query-param analogue. **This is a planned workstream — introduce a shared zod-parse + error-envelope helper and apply it route-by-route — not an ad-hoc patch target. Phase 2 report lists it under "recommended workstreams", Phase 3 schedules it. Do not fix piecemeal.** F-13 and the specific unbounded-field cases (`creditLimit`, cancellation-policy already bounded) can be handled inside that workstream. | Users/integrations get 500s for what should be 400/404; log noise; a few genuinely unbounded fields reach the DB. No stack leak (Next hides in prod). | grep sweep (zod/req.json/try across all 146) + spot reads |
| F-23 | **P3** | E/J | `src/app/api/health/route.ts:19`; `src/app/api/upload/dealer-document/route.ts:100` (+ 3 admin upload routes) | Routes echo raw `err.message`/`String(err)` to the caller. `/api/health` is **public** and leaks the DB driver error string (host/driver disclosure on failure); `upload/dealer-document` leaks R2/S3 SDK error text to a dealer. Admin upload/import/refund routes do the same but to trusted actors. | Internal infra detail disclosed to unauthenticated (`/api/health`) or semi-trusted (dealer) callers on error. | grep + file spot-reads |
| F-24 | **P1** (raised from P2, 2026-08-29 — it gates an ops action, see below) | D/C | `src/lib/delhivery/webhook.ts:60-66`, `src/lib/delhivery/tracking.ts:141-169` (vs `orders/[id]/route.ts:64-95`) | Carrier-driven `Order.status` writes bypass the fulfilment state machine: unconditional `update({data:{status}})`, no transition check, no compare-and-swap, no event dedupe, two drifted status maps. Webhook auth is `?token=` **in the URL** — leaks into nginx/Cloudflare access logs, proxy logs, and `Referer`. | Out-of-order/replayed/**forged** Delhivery event moves `Order.status` backward or `CANCELLED → SHIPPED` — silently un-cancels an already-refunded order in every UI (dealer + admin), and can drive false `SHIPPED` (→ F-02/F-17 tier errors). | code trace (promotes S-06) |
| F-25 | **P3** | D | `prisma/schema.prisma` — `OrderItem` (no indexes), `ProductVariant.productId`, `Shipment.status`, `Review.userId`, `StorageAuditLog` | Hot FK/filter columns unindexed. `OrderItem WHERE orderId IN (...)` (every order read) and `ProductVariant WHERE productId` (every PDP) are seq scans. | Slow order lists / PDPs as data grows; unbounded `StorageAuditLog`. Fix = new migration → Phase 3, blocked by H6. | code trace vs catalogued queries |
| O-1..O-6 | — | A/E | see "Observations" below | Consistency observations, not defects — logged so Phase 2 can decide. | — | code trace |

**Observations (unrated):**
- **O-1 — nav-vs-API section mismatch (generalises S-03).** `staff-access.ts` advertises sections to STAFF departments (`orders`→SALES/PRODUCTION/ACCOUNTS, `products`→MARKETING/PRODUCTION, `dealers`→SALES, `procurement/grn`→PRODUCTION) and `STAFF_NAV` renders links for them, but the matching **API** routes largely accept only `["ADMIN","SUPER_ADMIN"]`: `GET /api/orders` 401s STAFF (S-03), all `procurement/*` 401 PRODUCTION (S-08), all `admin/products/*` writes 401 MARKETING/PRODUCTION, `admin/dealers/[id]` PATCH 401s SALES. Net: several staff portal pages render with dead/erroring actions. Rate in Area H once the app runs.
- **O-2 — `crm/leads/[id]/convert` requires ADMIN/SUPER_ADMIN** while the rest of CRM accepts SALES/MARKETING staff. A SALES rep can run a lead through the whole pipeline but not convert it to a dealer. Plausibly intentional (account creation) — Phase 2 to confirm with product.
- **O-3 — `admin/settings/upi` POST** (sets the UPI VPA dealers pay into) is single-admin, no second-approver, no audit event. A compromised/rogue admin can redirect all manual payments. Contrast: cancellation-policy % changes write `updatedById`.
- **O-4 — `vendors/[id]/payments` POST** (record a payment to a vendor) is ADMIN-only; `admin/refunds/[id]/retry` allows ACCOUNTS. Pick one convention for "accounts staff touches money-out".
- **O-5 — vendor status not re-checked on `vendor/purchase-orders/[id]/accept|reject`** — a SUSPENDED/BLACKLISTED vendor keeps PO-response ability. Low impact.
- **O-6 — `GET /api/admin/settings/upi` and `GET /api/admin/settings/cancellation-policy` are intentionally public** (unauthenticated) — checkout + the public policy page consume them. Result: the company UPI VPA and the cancellation-fee % are world-readable. By design, low sensitivity; noted so Phase 2 doesn't re-flag it.

**Positive confirmations (close open map/hypothesis items):**
- `requireAdmin()` (`["ADMIN","SUPER_ADMIN"]`) is used uniformly across the entire ~45-route vehicle-CMS + reviews surface — no STAFF leakage, no `requireAuth`-style gap.
- Every account-creating route (`dealer/register`, `vendors` POST, `staff` POST, `crm/leads/[id]/convert`, `admins` POST) hashes passwords with `bcrypt.hash(pw, 12)`. Consistent.
- `crm/leads/[id]/convert` creates the dealer `status: "ACTIVE"` but the new `User` has `emailVerified: null` / `mobileVerified: false`, so `getVerifiedDealer` still blocks ordering until the dealer verifies — no verification bypass.

### Area A — DONE. Route matrix complete (~146/146 at the authz line; full-file reads for all non-uniform routes).

---

## 4d. Area E — input validation / error handling / rate limiting — 2026-08-29 (started)

Method: grep sweep for `z.object`/`safeParse`/`parse`, `await req.json()`, `try {` across all
~146 `route.ts`, plus the segment-1/2 rate-limit column.

### E-1 — systemic: no input-validation layer → **F-22**

| Metric | Count |
|---|---|
| Mutating routes total | ~120 (POST/PATCH/PUT/DELETE handlers) |
| Use zod (`z.object` + parse/safeParse) | **7** — `admin/test-email`, `auth/change-email`, `dealer/register`, `vendor/register`, `products` POST, `vendor/products` POST, `webhooks/razorpay` |
| Bare `await req.json()` with **no** try/catch and **no** schema | **~90** |
| Manual field checks (`if (!x) return 400`) only | most of the rest |

**F-22 (P3, E) — systemic missing input validation.** ~90 mutating routes destructure
`await req.json()` directly with no schema, no try/catch, no type/range/length/enum checks.
Two concrete consequences:
1. **Malformed/empty body → `SyntaxError` from `req.json()` → unhandled → generic HTTP 500** (not
   400). Every one of the ~90. Not a stack leak (Next hides it in prod) but wrong status + log
   noise + trivial to trigger en masse. The query-param analogue is **F-13** (`parseInt(page)`
   NaN → Prisma throw → 500), confirmed in every `admin/*` list route.
2. **Unchecked values reach Prisma**: e.g. `admin/dealers/[id]` PATCH takes `creditLimit`
   unvalidated (negative / 1e308 accepted); `admins` POST takes `userId` from body with no
   existence/current-role check (can promote any user, or 500 on bad id); `vendors/[id]/status`
   PATCH, `procurement/*`, the whole vehicle-CMS write surface — all bare. Prisma rejects
   genuinely malformed enum/FK values but with an unhandled 500, and accepts every
   in-type-but-out-of-domain value (huge numbers, 10 MB strings, wrong-but-valid IDs).

**Not affected / already correct:**
- `admin/settings/cancellation-policy` POST **does** bounds-check `0 ≤ pct ≤ 100` + `Number.isFinite` (money path — good), though its `req.json()` still throws on bad body.
- `orders` POST re-checks cart availability + `getVerifiedDealer`; `payments/*` verify Razorpay + Payment-row replay guards; `webhooks/*` HMAC. The critical money paths have *semantic* guards even without zod schemas.
- `rejectOversizedBody`/`JSON_BODY_MAX_BYTES` is applied on `orders` POST, `orders/[id]/cancel`, and all `auth/*` OTP routes — body-size DoS is bounded there, not elsewhere.

### E-2 — rate-limit coverage (from the matrix)

| Tier | Routes |
|---|---|
| Full budget + DB backstop (`enforceRateLimit`) | `auth/*` OTP/login/reset, `orders` POST, `orders/[id]/cancel` |
| Legacy per-IP only (`checkIPRateLimit`, fail-open, no DB backstop) | `auth/register`, `auth/send-email-verification`, `auth/change-email`, `contact`, `dealer/register`, `vendor/register`, `payments/upi/submit` (F-05 residual), `payments/upi/qr`, `admin/test-email`, `vehicles` GET |
| **None** | `products/search` (F-20), `shipping/serviceability` (F-19), `shipping/estimate`, `auth/verify-email` (F-16), every `admin/**` mutation, every `vendor/**` / `vendors/**` / `procurement/**` / `crm/**` route, `cart` GET/POST/DELETE, `orders/[id]` PATCH, `products/[id]` PATCH/DELETE |

Admin routes being unthrottled is normal (authenticated trusted actors). The gaps that matter
are the **unauthenticated** ones: `products/search`, `shipping/serviceability`, `shipping/estimate`
(needs a session but no rate limit — an authed dealer can hammer Delhivery rate calls).

### E-3 — error handling notes

- `webhooks/*` deliberately `catch → 200` (F-03, logged).
- `orders/route.ts`, `payments/verify`, `payments/create-order`, `products/[id]`,
  `orders/[id]/cancel` have real try/catch with typed error branches. Good.
- `admin/payments/[id]/verify` catches only `InsufficientStockError` — a `P2002` on
  `Invoice.orderId` (concurrent verify / double-UTR) rolls back with an unhandled 500 (**S-01**).
- The ~90 no-try routes: any Prisma `P2025` (update/delete on missing id) → unhandled 500
  instead of 404. Pervasive; rate as one P3 with F-22.
- **Positive:** grep for client-returned exception text — only `products` POST and
  `vendor/products` POST return `error.issues` (zod, expected/safe). **No route echoes raw
  Prisma error messages to clients.**
- **F-23 (P3, E/J) — a few routes echo `err.message` / `String(err)` to the caller:**
  - `GET /api/health` (`route.ts:19`) returns the DB driver's `err.message` — and `/api/health`
    is **public** (hit by `health.yml` cron; nginx exposure to confirm). A connection failure
    string can disclose DB host / driver. Return a generic string; keep detail in the log.
  - `POST /api/upload/dealer-document` (`:100`) returns `String(err)` to a **dealer** — leaks
    R2/S3 SDK error text (bucket, key prefix, AWS error codes). Same in `upload/product-image`,
    `upload/vehicle-image`, `upload/vehicle-type-image` (admin-only, lower concern).
  - `admin/products/import`, `admin/refunds/[id]/retry`, `admin/shipments`, `admin/test-email`
    return `err.message` but to **admins only** — acceptable, low priority.

**Area E status:** 🟡 — validation + rate-limit + error-leak done (F-22, F-23); per-route
mis-status pass folded into F-22.

---

## 4e. Area D — data layer — 2026-08-29 (started)

### D-1 — `Order.status` / `Shipment.status` writers → **F-24** (promotes S-06)

Three writers of `Order.status`, **three divergent state models**:

| Writer | File | Transition rule | CAS guard | Notes |
|---|---|---|---|---|
| Admin manual | `orders/[id]/route.ts:64-95` | explicit `FULFILLMENT_TRANSITIONS` DAG, forward-only, 409 on illegal | ✅ `updateMany({where:{status:current}})` | The correct one. Also the only `req.json()` here with `.catch(() => ({}))`. |
| Delhivery webhook | `src/lib/delhivery/webhook.ts:5-11,60-66` | `ORDER_STATUS_MAP` (6 entries incl. `CANCELLED`), unconditional `tx.order.update` | ❌ none | No transition check, no dedupe on `ShipmentTrackingEvent`, **no F-17 raw-status guard** (dormant — secret unset). |
| Tracking sync | `src/lib/delhivery/tracking.ts:141-169` | inline `orderStatusMap` (5 entries, **no `CANCELLED`** — already drifted from the webhook's), unconditional `tx.order.update` | ❌ none | Has the F-17 `rawSaysPreShip` guard (Item 1c) but still no transition/CAS guard. |

**F-24 (P1, D/C) — carrier-driven `Order.status` writes bypass the fulfilment state machine.**
The two Delhivery writers do unconditional `update({data:{status}})` with no check of the
current status and no compare-and-swap. Consequences:
- **Backward / illegal transitions.** A delayed, replayed, or out-of-order Delhivery event
  (there is no dedupe — `ShipmentTrackingEvent` rows are created unconditionally, no idempotency
  key) can move `Order.status` `DELIVERED → SHIPPED`, or `CANCELLED → SHIPPED/DELIVERED`,
  silently "un-cancelling" an order in every UI while its `OrderCancellation` row + refund
  already stand.
- **Two drifted copies of the map** (`ORDER_STATUS_MAP` vs the inline `orderStatusMap`) — a
  `CANCELLED` carrier status updates the order via the webhook but not via tracking-sync.
- **Webhook has no HMAC** — only `?token=` in the URL (`webhooks/delhivery/route.ts`). A token
  that leaks via proxy logs / Referer lets anyone POST arbitrary status transitions for any
  known waybill, and F-24's missing guards mean those writes land unvalidated.
Interacts with F-02/F-17 (all three are "carrier data drives Order.status without a guard").
S-06 is now F-24.

> ### ⚠ F-24 BLOCKS AN OPS ACTION — do not enable the Delhivery webhook push URL
> The user was about to have Delhivery configure the webhook push URL. **That is now blocked
> on fixing F-24.** Enabling it today arms a **forgeable, unauthenticated-in-practice endpoint
> (`?token=` in the URL) that can un-cancel refunded orders and forge fulfilment state.** Today
> the webhook secret is unset so the endpoint is inert; configuring the push URL is what makes
> it live.
>
> **Phase 3 fix scope (all five, together — this is one unit of work):**
> 1. **HMAC signature verification** on the raw body (like the Razorpay webhook already does) —
>    **not** `?token=` in the URL. Move off the query param entirely.
> 2. **Event dedupe** — idempotency key on `ShipmentTrackingEvent` (carrier event id / hash),
>    skip already-seen events.
> 3. **State-machine guard** — reject backward / out-of-DAG transitions; share the admin
>    `FULFILLMENT_TRANSITIONS` map (`orders/[id]/route.ts`) instead of a third copy.
> 4. **Compare-and-swap** on the `Order.status` write (`updateMany({where:{status:prior}})`),
>    matching the admin PATCH and payment/cancel routes.
> 5. **Reconcile the two drifted status maps** (`webhook.ts` `ORDER_STATUS_MAP` vs `tracking.ts`
>    inline `orderStatusMap`) into one shared table; while there, close the webhook-path half of
>    **F-17** (the `normalizeShipmentStatus` "Not Picked" gap) since it lives in the same code.
>
> Depends on: nothing code-side. Blocks: the Delhivery webhook rollout (ops).

### D-2 — N+1 — **largely NOT a problem in the API routes**

Every list route checked (`orders`, `admin/shipments`, `admin/payments`, `vendors`,
`procurement/purchase-orders`) uses a single `findMany` + nested `include`/`_count`, which
Prisma resolves in a bounded number of `IN (...)` queries — not per-row. No `for`-loop or
`.map(async …)` issuing per-row queries found in the list paths. `orders` GET does 3 sequential
awaits (user→dealer→orders) that could be `Promise.all`'d — micro, P3 at most. **Admin RSC
pages** (`src/app/admin/**/page.tsx`) not yet checked — deferred to Area H.

### D-3 — index gaps → **F-25**

Confirmed against real query patterns now catalogued:

| Missing index | Query that hits it | Where |
|---|---|---|
| `OrderItem` — **zero indexes** (`orderId`, `productId`, `variantId`) | `orders` GET list + every order-detail: `include:{items:{include:{product}}}` → `OrderItem WHERE orderId IN (...)` = seq scan | `orders/route.ts:37,53`, `orders/[id]/route.ts`, `finalize.ts` |
| `ProductVariant.productId` | every PDP + admin product edit loads `variants` by `productId` | `products/[id]` GET, `admin/products/[id]/variants` |
| `Shipment.status` | `admin/shipments` list filter/sort | `admin/shipments/route.ts:29` |
| `Review.userId` | user's reviews / "already reviewed?" checks | review routes |
| `StorageAuditLog` — zero indexes, **unbounded table** | any lookup + it only grows | `src/lib/storage/audit.ts` |
| `Payment.orderId` (has `@@index([orderId])` ✅) / `razorpayOrderId` (✅) | — OK, no gap | webhook `findFirst` |

**F-25 (P3, D) — missing indexes on hot FK/filter columns**, chiefly `OrderItem` (loaded on
every order read) and `ProductVariant.productId` (every PDP). Needs a new migration → **Phase 3
+ blocked by H6** (DECISION-RULES §1.5: no migrations while drift is unresolved). Log only.

### D-4 — still owed
- H6 manual migration diff (blocked on shadow DB — manual line-diff is the fallback, not done).
- Transaction-boundary sweep beyond order/payment/cancel (procurement PO→PR, GRN→PO receivedQty,
  `crm/leads/[id]/convert` User+Dealer+Lead — is convert wrapped in `$transaction`?).
- `admin/*` RSC page query cost (Area H).

**Area D status:** 🟡 — writers/state-machine (F-24), N+1 (clear), index gaps (F-25) done;
H6 + txn sweep + RSC pages owed.

Open sub-items: the `parseInt(page)` NaN crash (F-13) confirmed also in `admin/dealers/route.ts:19`
and every `admin/*` list route.

---

## 5. RESUME POINTER

**Area A (auth/authz route matrix): COMPLETE** (segments 1 + 2, §4b/§4c).

**Done this session (2026-08-29):** Area A (route matrix complete, §4b/§4c), Area E partial
(§4d — F-22/F-23), Area D partial (§4e — F-24/F-25). Next: finish D, then G, H, I, J, K.

1. **Area D — H6 manual migration diff** (blocked on shadow DB; manual line-diff of
   `prisma/migrations/0_init/migration.sql` + 4 later vs `schema.prisma` is the fallback, not
   done). Suspect columns listed under H6 above.
2. **Area D — txn sweep:** `crm/leads/[id]/convert` (User+Dealer+Lead — wrapped?),
   procurement PO→PR conversion, GRN `receivedQty` updates.
3. **Area G:** 3 cached-read surfaces only (`api/vehicles` `revalidate=86400`, `products/[id]`
   `revalidatePath`, `sitemap`); Redis used only by `rate-limit.ts` + dead `shiprocket/auth.ts`.
   Confirm no `unstable_cache`; map each cached read → its invalidation (or absence).
4. **Area H:** run the app (`npm run dev`), walk every route; specifically test O-1/S-03/S-08
   (staff nav links → do the pages 401 or render-with-dead-actions?), and the admin RSC page
   query cost (D-2 deferral).
5. **Area I:** Flutter app — `motoxplus_app/lib/**` (22 .dart files): `core/api/api_client.dart`
   token storage (`flutter_secure_storage`), `razorpay_flutter` flow, deep links / nav dead
   ends, any secret bundled in `android/app/`.
6. **Area J:** PM2 (`instances:"max"` cluster × in-memory rate-limit fallback — H5 residual),
   `/api/health` only checks DB `SELECT 1` (not Redis/R2/Delhivery) + leaks err (F-23),
   `scripts/db/backup.sh` + `restore.sh`, logging-of-secrets grep (OTP/token/phone in
   `console.log`).
7. **Area K:** `src/lib/r2.ts` vs `src/lib/storage/r2.ts` duplicate; `@cashfreepayments/cashfree-js`
   unused; `src/lib/shiprocket/*` dead (F-10); unused-export sweep.

**Deliverable state:** `AUDIT/01-findings.md` is the running log. `AUDIT/02-report.md` (Phase 2)
not started. Findings now **F-01…F-25 (F-22 reclassified to a Phase-3 workstream) + S-01…S-10
(S-06 promoted→F-24) + O-1…O-6**.

### Re-rating / re-sequencing applied 2026-08-29 (per user)
| Finding | Was | Now | Why |
|---|---|---|---|
| F-24 | P2 | **P1** | Gates an ops action — enabling the Delhivery webhook push URL arms a forgeable endpoint that can un-cancel refunded orders. **Webhook rollout blocked until fixed.** Fix scope (HMAC not `?token=`, dedupe, state-machine guard, CAS, map reconciliation) in §4e D-1. |
| F-21 | P2 | **P1** | Prepaid: money taken for an undeliverable order, zero alert. Two-part fix (serviceability check before payment + AWB-failure surfacing) noted on the finding. |
| F-05 | P1 | P1 (**sequence: first on Razorpay**) | Added the prepaid-no-stock-reservation trigger; it's THE Razorpay go-live blocker. |
| F-22 | P3 finding | **Phase-3 workstream, not a finding** | ~90 routes = a shared-helper rollout, planned not patched piecemeal. |

---

## 6. Emergency batch — changes shipped (2026-08-28)

Scope was fixed: F-02/F-04 (+ new Item 1c), F-03, F-14 (Option 1), F-07. Everything
else noticed is logged unfixed above. One commit per item, each with a
failing-then-passing test targeting the extracted lib function (no route-test
infra in this repo — DECISION-RULES §2).

### F-02 + F-04 — cancellation fee tier + Delhivery-cancel wiring — **STOPGAP → mostly real**

New pure logic in `src/lib/orders/cancellation.ts` + `cancellation-gate.ts`;
`classifyCarrierTier` in `src/lib/delhivery/carrier-cancellation.ts`
(one live track call, `retries:1`, 10 s timeout, **no DB writes**, reads raw
`Status.Status`/`StatusCode`/`PickedupDate` only — never `normalizeShipmentStatus`
or `Order.status`, DECISION-RULES §3).

- **Dealer path** (`POST /api/orders/[id]/cancel`, `cancellation-preview`): gate =
  local decision first (Order.status SHIPPED → block; no shipment → allow;
  `Shipment.status` past pickup → block; shipment older than
  `Setting["cancellation.carrierStaleDays"]`, default **3** → block), then ONE
  `classifyCarrierTier` call only when the shipment is fresh + PENDING/MANIFESTED.
  `PRE_SHIP` → allow at pre-ship %; `POST_SHIP` / `FETCH_FAILED` → 422, route to
  admin. Fails closed throughout.
- **Admin path**: fee tier defaulted from `classifyCarrierTier` (not Order.status);
  `FETCH_FAILED` → POST_SHIP; `body.tierOverride` (`PRE_SHIP|POST_SHIP`) honoured
  and any deviation from the defaulted tier logged to `OrderEvent`
  (`type: "CANCELLATION_TIER_OVERRIDE"`).
- **F-04 (real fix)**: `cancelDelhiveryShipment(waybill)` is now called **before**
  any mutation whenever the order has a Shipment row (dealer-allowed or admin). If
  it throws or returns `accepted !== true` → **422, nothing mutated** (no CANCELLED,
  no OrderCancellation, no refund). Idempotent + retry-safe per `cancel.ts` docs.
- **Still open (Phase 3)**: the `defaultAdminStageFromCarrier` UI (admin toggle to
  pick the tier) is API-only in this batch — the shared `CancelOrderAction`
  component shows `preview.carrierStatus` but has no override control yet.
  `DELHIVERY_WEBHOOK_SECRET` still unset → the gate's carrier fetch is the primary
  mechanism, not a backstop, until Delhivery configures the push URL (out of batch,
  needs carrier-side action). The concurrent-`create.json` double-manifest race
  (F-03) is unaffected by this item.

### Item 1c — F-17 `Order.status → SHIPPED` write-guard — **partial (tracking-sync path only)**

`syncTrackingToDb` now checks `isPreShipCarrierStatus()` against the raw carrier
fields before writing a `SHIPPED` transition — a "Not Picked"/manifested parcel no
longer records a false `SHIPPED` (which drove the 20% over-charge + dealer block).
`Shipment.status`, `normalizeShipmentStatus`, `ORDER_STATUS_MAP` and the **webhook**
are untouched (blast radius). **Still open**: the webhook path has the identical
F-17 bug (dormant — secret unset); `normalizeShipmentStatus` itself; both Phase 3.

### F-03 — duplicate AWB — **STOPGAP (retry variant closed, concurrent variant open)**

- `delhiveryPost` gained an optional `{ retries }`; `createDelhiveryShipment` passes
  `{ retries: 1 }` for `POST /api/cmu/create.json` (one attempt, no auto-retry).
  Read-only Delhivery calls keep the default 3.
- `Shipment.orderId`/`waybill` unique constraints **verified** in
  `prisma/migrations/0_init/migration.sql:1310,1313`. The transaction is now wrapped:
  a `P2002` (concurrent create won the race) is caught, logged as
  `DUPLICATE AWB LIKELY … Reconcile with Delhivery`, and the existing Shipment row
  returned instead of a 500.
- **Still open (Phase 3)**: the concurrent-call variant (two `finalize`s, webhook +
  admin click) still hits `create.json` twice before the DB constraint bites — needs
  an advisory lock. Carrier-side reconciliation of already-orphaned AWBs needs
  Delhivery data (Step 3 note).

### F-14 — session revocation — **Option 1 (Bearer/mobile path) shipped; web path → F-18**

- `getAuthUser` now cross-checks `UserSession.isActive`/`expiresAt` (one indexed-PK
  query per authenticated request) — every `getCurrentUserId` caller gets what only
  `requireAuth`'s 3 routes had. `mobile/auth/me` rewritten onto `getAuthUser`
  (closes F-14b).
- `getCurrentUserId` **fallthrough guard**: if an `mx_access`/Bearer token is
  present, its result is authoritative — no fall-through to the NextAuth cookie
  (which the web REST-login also sets). A revoked Bearer session can no longer slip
  through as a web session in the first 15 min.
- **Behaviour change to watch**: a web user whose `mx_access` is present-but-invalid
  (e.g. `JWT_SECRET` rotated) gets 401 on API routes for ≤15 min until the cookie
  expires and the NextAuth fallback resumes. Rare; acceptable.
- **Web (NextAuth-cookie) path unchanged** → **F-18** (a: no UserSession
  cross-check; b: unbounded web session lifetime). Interim: `SECRET-ROTATION.md`
  break-glass + `disable` route comment (both shipped).

### F-07 — concurrent refund retry double-pay — **real fix (cheap, in scope)**

`admin/refunds/[id]/retry`: added an atomic `updateMany` guard
(`refundStatus: "FAILED" → "INITIATED"`) that **claims** the retry before calling
Razorpay; `count === 0` → 409. Catch block now resets `FAILED` so a genuine failure
stays retryable. Two concurrent retries can no longer both issue a refund.

### Not run (waiting on inputs)

- **Step 3** (data-state queries) and **Step 4** (H6 migration diff) — need the Neon
  branch URL. Step 3 mirror query (over-charged POST_SHIP cancels whose parcel was
  never picked up, per Amendment 2) is queued.
- Prod config unconfirmed: `NEXT_PUBLIC_RAZORPAY_ENABLED`, `RAZORPAY_KEY_ID` prefix,
  `DELHIVERY_WEBHOOK_SECRET`. None of the shipped code assumes a value.

---

## 6b. Step 6 — verification deliverables (2026-08-29)

### Git-packaging status — the batch is PUSHED; split blocked

The entire emergency batch is **one squashed commit `25f4797 "all"` (2026-08-28 23:16), and it
is on `origin/main`** (`git branch -vv`: `main … [origin/main]`, 0 ahead / 0 behind). Two more
commits sit on top (`4cf9d18` docs, `d006ab6` scripts fix), then `c70c528` "all" (a partly-
committed push-notification feature), all pushed. There is also **uncommitted push-notification
WIP** in the working tree (8 modified files + `src/lib/push/order-notifications.ts` +
`src/app/api/mobile/push-token/route.ts`).

`25f4797` also bundles unrelated changes: `AUDIT/01-findings.md`, `AUDIT/DECISION-RULES.md`,
`scripts/add-test-product.mjs`, `SECRET-ROTATION.md`.

**Per the user's instruction ("if anything is already pushed, tell me before rewriting
history") the reset-and-recommit is NOT done.** Options are in the session response; awaiting a
decision. Recommendation: forward-only — leave `25f4797` as history; if F-04 (Item 3) misbehaves,
revert just its hunks in `orders/[id]/cancel/route.ts` (a manual hunk-revert, ~30 lines — the
squash makes it manual, not impossible).

### Typecheck / lint / build / test — verbatim

Run against the current working tree (**includes the uncommitted push-notif WIP** — noted where
it matters). Local Postgres is not reachable from this environment (`DATABASE_URL` →
`localhost:5433`, no tunnel).

**`npx tsc --noEmit`** → exit **0**, no output. Clean.

**`npx next lint`** → exit **0**. **0 errors, 160 warnings** (all pre-existing:
`@typescript-eslint/no-explicit-any` ×~150, `no-console` ×~10, spread across `src/lib/**`,
`src/app/**`, test files). No new warnings from the batch.

**`npm run build`** → **FAILS**, but **environmentally, not a code defect**:
```
   Generating static pages (111/148)
{"level":"error","msg":"Prisma error","target":"user.findMany",
 "error":"Can't reach database server at `localhost:5433`"}
Error occurred prerendering page "/admin/staff"
Error [PrismaClientInitializationError]: Can't reach database server at `localhost:5433`
Export encountered an error on /admin/staff/page: /admin/staff, exiting the build.
 ⨯ Next.js build worker exited with code: 1
```
`tsc` + webpack compile + 111/148 static pages succeed; the build then dies trying to
**prerender `/admin/staff` and `/admin/products/new`, which query Prisma at build time**. On the
VPS the DB is reachable so prod builds pass — but this is itself a finding: **→ new S-09**
(admin RSC pages statically prerendered with build-time DB access; fragile, and bakes stale
data unless they opt into dynamic rendering). Not batch-related.

**`npx vitest run`** — two states:

*Clean `HEAD` (`c70c528`, push-notif WIP stashed):*
```
 Test Files  18 passed (18)
      Tests  168 passed (168)
   Duration  22.58s
```

*Current working tree (push-notif WIP applied):*
```
 ❯ src/lib/delhivery/tracking.test.ts (10 tests | 2 failed)
   × does NOT write Order.status = SHIPPED for a raw 'Not Picked' (pre-pickup) parcel
   × DOES write Order.status = SHIPPED once the parcel is genuinely picked up
   TypeError: Cannot read properties of undefined (reading 'status')
    ❯ Module.syncTrackingToDb src/lib/delhivery/tracking.ts:102:43
 Test Files  1 failed | 17 passed (18)
      Tests  2 failed | 166 passed (168)
```
**The 2 failures are caused by the uncommitted push-notif WIP, not the batch.** That WIP added
`include:{order:{select:{status:true}}}` + `const priorOrderStatus = shipment.order.status` to
`syncTrackingToDb` but did not update `tracking.test.ts`'s `shipment.findUnique` mock (which
returns no `.order`). At `25f4797` and at `HEAD` the file is green. **→ new S-10** (uncommitted
WIP ships with 2 failing tests; mock not updated for the new relation load).

### Fails-before / passes-after — per item

Method: `git stash -u` the WIP, `git checkout 25f4797^ -- <pre-existing source files the batch
touched>` (tests + net-new modules kept at HEAD), run the batch's tests, then restore. Non-
destructive; tree returned to exact prior state.

| Item | Test file | Fails before the fix? | Evidence |
|---|---|---|---|
| **F-03** (retry cap + P2002 recovery) | `src/lib/delhivery/shipment.test.ts` (net-new) | **YES** | `expect(delhiveryPost).toHaveBeenCalledWith("/api/cmu/create.json", …, { retries: 1 })` → fails (called with no opts); "recovers from a P2002" → throws `PrismaClientKnownRequestError` instead of returning the existing row. |
| **F-14** (session cross-check) | `src/lib/auth/middleware.test.ts` (net-new) | **YES** | 4/6 fail against pre-fix `middleware.ts`/`current-user.ts`: "returns null when the session has been revoked" → returns the payload; "does not consult NextAuth when a Bearer token is present but revoked" → `expected 'u1' to be null`. |
| **F-17 / Item 1c** (SHIPPED write-guard) | `src/lib/delhivery/tracking.test.ts` F-17 block (net-new block, pre-existing `syncTrackingToDb`) | **YES** | "does NOT write Order.status = SHIPPED for a raw 'Not Picked'" → `txOrderUpdate` **called** with `{data:{status:"SHIPPED"}}` — exactly the bug. |
| **F-02 / F-04** (carrier-aware gate, Delhivery-cancel wiring) | `carrier-cancellation.test.ts`, `carrier-status.test.ts`, `cancellation.test.ts` new blocks (all net-new exports: `classifyCarrierTier`, `evaluateDealerGateLocal`, `resolveDealerGateFromCarrier`, `defaultAdminStageFromCarrier`) | **N/A — no "before"** | The functions and their tests were introduced together. There is no prior version to fail. The *route*-level behaviour (dealer 2%-cancel of an in-transit order) has **no unit test** — only the integration script below. |
| **F-07** (concurrent refund-retry guard) | — | **NO TEST** | Fix is a route-level `updateMany` claim guard in `admin/refunds/[id]/retry/route.ts`; no extracted lib fn, no route-test infra in this repo. Covered only by the integration script (§ below), which is **not part of `npm test`** and needs a running app + DB. |

**Honest summary:** F-03, F-14, F-17/1c have genuine fail-before/pass-after unit tests. F-02/F-04
have thorough tests of their *new pure logic* but nothing that exercises the actual cancel route,
and F-07 has no automated test at all. The route-level behaviour of all three rests on
`scripts/security/cancellation-exploit-test.ts` (below), which has never been run here.

### Manual staging verification script

`scripts/security/cancellation-exploit-test.ts` **already exists** (added in the batch, 229
lines) and covers the exploit end-to-end + the admin override + F-07. It has **not been run**
(needs a running app + its DB; ideally a real staging Delhivery AWB). To run on staging:

```
# 1. Point at staging, seed a real MANIFESTED (pre-pickup) AWB on the staging Delhivery account
BASE_URL=https://staging.motoxplus.<...> \
TEST_WAYBILL=<a real pre-pickup AWB on the staging Delhivery account> \
npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/security/cancellation-exploit-test.ts
```

What it asserts (exits non-zero on any failure):
1. **Dealer cancel, fresh MANIFESTED shipment** — *with* a real pre-pickup AWB → allowed at
   `PRE_SHIP`, parcel cancelled with Delhivery first; *without* → `422`, order stays
   `PROCESSING`, **no `OrderCancellation` row, no refund** (F-04).
2. **Age backstop** — MANIFESTED shipment older than `carrierStaleDays` (default 3) → dealer
   cancel `422`, order untouched.
3. **Local fast-path** — `Shipment.status = IN_TRANSIT` → dealer cancel `422` with no carrier
   fetch.
4. **Admin tier override** — admin cancels with `tierOverride: "POST_SHIP"` → succeeds (real
   AWB) and writes an `OrderEvent{type:"CANCELLATION_TIER_OVERRIDE"}` recording
   `carrier / defaulted / chosen`; without a real AWB → `422`, nothing mutated.
5. **F-07** — two concurrent `POST /api/admin/refunds/{id}/retry` → **exactly one** gets `409`;
   the other `200`/`502` but never both proceeding to `refundPayment`.

**Gap vs. the ideal end-to-end script:** it seeds orders directly in the DB rather than driving
signup → browse → cart → order → pay. A full happy-path exploit reproduction (place a real order,
pay, wait for MANIFEST, then cancel) is not automated. Recommend running this script on staging
with `TEST_WAYBILL` set as the acceptance gate for the batch before it's considered verified.

---

## 7. `normalizeShipmentStatus` "Not Picked" — blast-radius report (requested, v2 §"Not Picked")

The v2 prompt asked: fix the missing "Not Picked" mapping *in* `normalizeShipmentStatus`,
but first enumerate every consumer and report what else changes; if the effect reaches
beyond the tier decision, fall back to a narrower fix and log the normalizer gap.

**Consumers of `normalizeShipmentStatus` (grepped, whole repo):**

| # | Call site | Result feeds |
|---|---|---|
| 1 | `webhook.ts:26` | `Shipment.status` write (`:54`); `deliveredAt` (`:56`); `ORDER_STATUS_MAP[…]` → **`Order.status` write** (`:60-66`) |
| 2 | `tracking.ts:47` (`mapTrackingDetail`) | `TrackingResult.status` → (a) `fetchLiveTracking` return → **tracking page display** (`orders/[id]/tracking`), (b) `syncTrackingToDb` `newStatus` → `Shipment.status` write (`:133`), `deliveredAt` (`:137`), `orderStatusMap[…]` → **`Order.status` write** (`:167`, now F-17-guarded) |
| 3 | `tracking.test.ts` | assertions pinning current behaviour |

**What adding `"not picked": "MANIFESTED"` to `DELHIVERY_STATUS_MAP` would change:**

- `normalizeShipmentStatus("Not Picked")`: `"IN_TRANSIT"` → `"MANIFESTED"`.
- **webhook path** — an inbound "Not Picked" webhook: `Shipment.status` IN_TRANSIT→MANIFESTED,
  and `ORDER_STATUS_MAP["MANIFESTED"]` is `undefined` so the **`Order.status = SHIPPED`
  write stops happening**. That is an `Order.status` transition change — **beyond the tier
  decision.**
- **tracking display** — a pre-pickup parcel's tracking page status flips IN_TRANSIT→MANIFESTED
  for every viewer, not just the cancellation flow.
- **`syncTrackingToDb`** — `Shipment.status` write changes IN_TRANSIT→MANIFESTED (the
  `Order.status` SHIPPED write is already prevented here by the F-17 guard, so no *further*
  change on that line — but the `Shipment.status` column value does change).
- **ordering hazard** — `normalizeShipmentStatus` returns the *first* `DELHIVERY_STATUS_MAP`
  key whose lowercased string is `includes()`-contained in the raw status. `"not picked up"`
  already contains the existing key `"picked up"` → today returns `PICKED_UP`. Whether a new
  `"not picked"` key wins depends on its **insertion position** relative to `"picked up"`.
  Silent, position-dependent correctness — the signature of a function that should not be
  extended piecemeal.
- **test** — the `tracking.test.ts` assertion documenting the IN_TRANSIT fall-through breaks.

**Verdict: blast radius exceeds the tier decision.** Per the instruction, the narrower fix
was taken instead and shipped in the batch:
1. tier decisions read **raw** carrier fields (`carrier-status.ts` / `carrier-cancellation.ts`),
   never `normalizeShipmentStatus` — DECISION-RULES §3;
2. the one place `normalizeShipmentStatus`'s gap actually writes bad state
   (`syncTrackingToDb` → `Order.status = SHIPPED`) got the narrow F-17 write-guard.

**Logged for Phase 3 (F-19):** `normalizeShipmentStatus` still (a) maps unknown/`"Not Picked"`
to `IN_TRANSIT` rather than a distinct `UNKNOWN`/`MANIFESTED`, (b) has the `"not picked up"`
→ `PICKED_UP` substring collision, (c) the **webhook** path has the same unguarded
`Order.status = SHIPPED` write as the pre-F-17 tracking path (dormant only because
`DELHIVERY_WEBHOOK_SECRET` is unset). The Phase-5 DB-driven status-map redesign
(`docs/delhivery-open-items.md` item 3) is the real home for (a)/(b).

---

## 8. Post-commit verification run (session 2026-08-29, no Neon branch / no prod config)

Re-ran the batch's checks on a clean tree at `25f4797`:

| Check | Result |
|---|---|
| `npx vitest run` | **168 passed / 168**, 18 files (incl. `carrier-status`, `carrier-cancellation`, `cancellation`, `auth/middleware`, `shipment`, `tracking`) |
| `npx tsc --noEmit` | **1 error** → fixed (see below) → **clean** |
| `npx next lint` | **pass** — only pre-existing `no-explicit-any` / `no-console` warnings, none in batch files beyond the repo baseline |
| `npm run build` | TypeScript + route-module collection **compile clean**; `next build` then fails at **static prerender** of DB-backed admin pages (`/admin/products/new` etc.) because no local Postgres is running (`localhost:5433` refused). Environment limitation, not a code defect — will complete once the Neon branch is the build `DATABASE_URL`. |

**Fixed this session:** `scripts/security/cancellation-exploit-test.ts:204` — the seeded
`prisma.payment.create` used `method: "RAZORPAY" as any` (no such field on `Payment`) and
omitted the required `paymentType`. Was both a typecheck failure and a guaranteed runtime
failure of the F-07 section of the script (which the prior session could not run — no DB).
Changed to `paymentType: "FULL_100"`.

**Found, not fixed — needs a call (logged as F-20, minor):** `cancel/route.ts` — when an
**admin** cancels an order that has **no `Shipment` row**, `body.tierOverride` is ignored for
the fee calculation (the override is only applied inside `if (!isDealerActor && order.shipment)`,
`:129-138`) but the `CANCELLATION_TIER_OVERRIDE` `OrderEvent` is still written (`:223`, guarded
only on `tierOverride !== defaultedStage`). Net: the audit log records an override that was
not actually applied to the charge. Edge case (admin overriding tier on a shipment-less order).
Options: (i) ignore `tierOverride` entirely + skip the event when `!order.shipment`, or
(ii) honour the override for shipment-less orders too. (ii) is a small policy question —
deferred.
