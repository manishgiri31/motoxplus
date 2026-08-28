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
| A auth/authz — helper modules | ✅ | `auth.ts`, `lib/auth/*`, `middleware.ts`, `staff-access.ts` all read |
| A route matrix (~146 routes) | 🟡 ~40/146 | all `auth/*` + `mobile/auth/*`, orders, cart, payments, uploads, files, admin/payments, admin/shipments read. **~106 routes not yet in the matrix.** |
| B money | 🟡 | Order-create, Razorpay verify/create, UPI submit, admin verify/reject/retry, cancellation lib read. Refund tiers + GST-on-fee traced. Not read: `payments/upi/qr`, `payments/upi/[orderId]`, invoice generation/PDF. |
| C shipping | ✅ code / 🟡 vs live | `client/shipment/tracking/cancel/webhook/serviceability/rates` read; reconciled with `docs/delhivery-audit.md`. |
| D data layer | 🟡 | Transactions in order/payment/cancel paths traced; index audit from map §3 not yet confirmed query-by-query; N+1 sweep of admin list pages ⬜ |
| E API surface (validation/errors/rate-limit table) | ⬜ | needs the full route matrix first |
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
| F-05 | **P1** | B | `src/lib/payments/finalize.ts:288-333` | `Payment→PAID` write is outside the `$transaction`; if the txn throws (`InsufficientStockError`), Payment is `PAID` but order stays `PENDING`, and every later webhook delivery no-ops on `status==="PAID"`. Webhook returns 200 on processing error (`webhooks/razorpay/route.ts:118-123`) → no Razorpay retry. | (Razorpay live) Dealer's money captured, order never confirmed, silent — only a `console.error`. | code trace |
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
- **S-06 (D):** `Order.status` is written from three uncoordinated places (admin PATCH,
  Delhivery webhook, `syncTrackingToDb`) with different maps and no ordering guard — a
  late/out-of-order webhook can move `Shipment.status` *and* `Order.status` backwards
  (`delhivery-audit.md` "MEDIUM — webhook has no dedupe or out-of-order protection"). Interacts
  with F-02. Rate after the full state-machine enumeration in Area B.
- **S-07 (J):** Brief says "Hostinger VPS PostgreSQL"; git history (`df12334 connect neon db`)
  and the leaked `DATABASE_URL` shape suggest **Neon**. Affects backup/restore assumptions.
  Needs confirmation from the team / current `.env` value (not read).

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

## 5. RESUME POINTER

**Next area:** finish **Area A — the route matrix**. ~40 of ~146 route handlers are traced
(matrix segment 1 in §4b); ~106 remain.

**Next unreviewed files (start here):**
1. `src/app/api/admin/**` — the entire tree except `payments/*` and `shipments` (≈70 routes):
   start with `admin/dealers/*`, `admin/users/[id]/*`, `admin/settings/*`, `admin/stats`,
   `admins/*`, `staff/*`, then the vehicle-CMS tree (`admin/vehicles/**`, ~40 routes — these
   all go through `requireAdmin()` which is `["ADMIN","SUPER_ADMIN"]`, so spot-check for
   deviations rather than reading all 40).
3. `src/app/api/vendors/**`, `vendor/**`, `procurement/**`, `crm/**`.
4. `src/app/api/products/**`, `categories`, `vehicles`, `contact`, `dealer/**`.
5. `payments/upi/qr`, `payments/upi/[orderId]`.

**Then:** Area D manual migration diff (H6) → Area E rate-limit + validation table (falls out
of the matrix) → Area G cache-invalidation map → run the app for Area H → Area I Flutter →
finish Area J (PM2/health/backup) + Area K unused-export sweep.

**Deliverable state:** `AUDIT/01-findings.md` is the running log; `AUDIT/02-report.md` (Phase 2)
not started.
