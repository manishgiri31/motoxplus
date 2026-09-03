# AUDIT / 02 — Phase 2 Report

Date: 2026-09-03. Basis: `AUDIT/00-map.md` (Phase 0 recon) + `AUDIT/01-findings.md` (Phase 1,
the running evidence log — every claim here is cross-referenced there). Repo at `dc1ddf7`
(+ local audit commits `2e45a83`…). Production HEAD tracked separately by the team.

This report is a summary and a plan. `01-findings.md` is the authority for detail, code
locations, and verification method.

---

## 1. Plain-language summary (no codebase needed)

**What this is.** MotoXplus is a B2B motorcycle-parts platform: a Next.js web app (dealer
portal + admin back-office + public catalogue) on a single Hostinger VPS, a Flutter dealer
mobile app, PostgreSQL, and integrations with Razorpay (payments), Delhivery (shipping), an
SMS/WhatsApp OTP provider, Cloudflare R2 (file storage) and Resend (email).

**The headline.** The code quality is generally good — money-handling transactions are
careful, there's a real rate-limit design, the emergency-batch fixes are sound. But **three of
the four external integrations have never actually worked correctly in production**, and nobody
noticed because **almost nothing that fails is surfaced to a human** — failures go to a log
file that no alert watches.

1. **Shipping has a 0% success rate.** Every one of the ~4 orders that should have generated a
   courier shipment failed silently. Root cause: for months the request sent to Delhivery was
   missing a required field. That specific bug was fixed on 2026-08-25, but no qualifying order
   has been placed since, so the fix is unproven, and the *class* of problem — a shipment
   failure that only a `console.error` records — is still there. (**F-21**, now P1.)

2. **The mobile app is dead.** The shipped Android app has the backend address hardcoded to a
   Vercel URL that no longer resolves (the Vercel account was deleted). Any dealer who installed
   it, or downloads it from the website, gets an app that cannot reach any server at all.
   (**F-31**, P1.)

3. **Rate limiting never ran.** The app was configured to use Redis for cluster-wide rate
   limiting, but Redis was never installed on the server. For the entire life of the product,
   every rate limit has been a much weaker per-process fallback that resets on every restart —
   and a bug in that fallback path was silently crash-looping the server workers and dropping
   in-flight requests. Redis is now installed (2026-09-03) and the leak is fixed
   (**F-26/F-27**), but distributed rate limiting is now enforced *for the first time* — watch
   for legitimate traffic hitting limits.

4. **Payments are now live and mostly OK.** Razorpay went live in production. One real
   money-loss bug (a captured payment could be stranded against an unconfirmed order with no
   retry) was found and fixed on 2026-09-03 (**F-05**). No dealer actually lost money to it —
   the production data shows zero occurrences — but with payments live it was the right fix to
   ship first. A deeper fix (reserve stock before payment) is planned as workstream **W-1**.

**The good news from the production data.** The scary-sounding cancellation exploit (dealer
cancels a shipped order, keeps the goods, gets a near-full refund) was **never actually
reachable** — because shipping never worked, there was never a real parcel to exploit. The
migration history is clean (disaster recovery works). The secrets that leaked into git history
in June are a real exposure, but there's still no confirmation they were rotated (**F-01**).

**What to do, in order:** fix the mobile app's backend URL (F-31), make shipping failures
visible and verify the shipping fix on a real order (F-21), confirm the June secrets were
rotated (F-01), harden the Delhivery webhook before turning it on (F-24), then the payment
lifecycle work (W-1). Everything else is P2/P3 cleanup.

---

## 2. Per-area health ratings

Legend: 🟢 healthy · 🟡 issues, contained · 🟠 material gaps · 🔴 serious / not working · ⬜ not assessed

| Area | Rating | One-line |
|---|---|---|
| **A — Auth / authz** | 🟠 | Route matrix complete (~146/146 at the authz line). `/api/*` is not covered by middleware — every route self-checks, and it's *mostly* done consistently, but F-06 (staff dept check), F-14/F-18 (session revocation), F-15 (email-change takeover), and the O-1 staff-nav-vs-API cluster remain. |
| **B — Payments / money** | 🟠 | Razorpay live. F-05 fixed; transaction discipline in the money paths is good; Float money model has only cosmetic issues (H4). Open: F-21 (shipping billed but never ships), F-28 (manual payments have no ledger row → refunds break), F-29 (hardcoded bank details), F-11 (GST invoice rounding), W-1. |
| **C — Shipping / Delhivery** | 🔴 | The integration has **never worked in production** (F-21). F-24 (forgeable webhook) blocks turning on live tracking. F-03 (duplicate AWB) partly fixed. F-17 (false "shipped") partly fixed. Everything here needs the fix *and* a way to see failures. |
| **D — Data layer** | 🟡 | H6 migration drift **RESOLVED — no drift, DR works**. Money-path transactions are correct. Open: F-24 (unguarded status writers), F-25 (missing indexes — now unblocked), F-30 (procurement/CRM not transactional). Admin page query cost not measured (needs Area H). |
| **E — API validation / errors / rate-limit** | 🟠 | F-22: ~90 mutating routes have no input-validation layer (`parseInt` → NaN → 500, no body schema) — a planned rollout, not piecemeal patches. F-13, F-16, F-19, F-20, F-23 are the individually-notable instances. |
| **F — Next.js 15** | 🟢 | Clean. Async `params`/`searchParams` handled correctly everywhere; tsc passes. The only Next-shaped issues are S-09 (admin pages baked at build) and O-8. |
| **G — Caching / Redis** | 🟡 | Redis is used *only* for rate limiting and **was never installed** (F-27) — now fixed operationally. No application cache layer at all (O-8): `/api/vehicles` is cached 24h with no invalidation, everything else is uncached per-request Prisma. Fine at current scale, a cliff later. |
| **H — Web UI / UX** | ⬜ | **Not assessed.** Needs the app running against a database; the audit environment has neither a local DB nor a tunnel. Owed: admin RSC page query cost, staff-portal nav behaviour (O-1/S-03/S-08), a visual/UX pass. |
| **I — Flutter mobile app** | 🔴 | F-31: the app points at a dead host → **completely non-functional**. F-32 (says "Payment successful" when it wasn't), F-33 (spurious logout on token expiry). O-9 minor items. |
| **J — Ops & security** | 🟠 | F-27 (missing infra undetected), O-10 (backups never verified or alerted on), F-23 (health endpoint leaks errors), S-09 (build fragility). DR **confirmed working** (H6). Secrets: F-01 rotation still unconfirmed. |
| **K — Dead weight** | 🟢 | Minor: `@cashfreepayments/cashfree-js` (unused), Shiprocket (~400 LOC dead), `src/lib/r2.ts` shim with 2 stragglers. All O-11 / F-10. |

---

## 3. Complete findings table

Severity at time of report. "Status": ✅ fixed & verified · 🔶 partially fixed · 📋 planned (workstream) · ⬜ open · ➖ resolved as non-issue / by data.

### P0 / P1

| ID | Sev | Area | Status | Summary |
|---|---|---|---|---|
| **F-01** | P0 | J | ⬜ | Production `.env` (DB URL+password, `NEXTAUTH_SECRET`, `JWT_SECRET`, `RAZORPAY_KEY_SECRET`, R2/Delhivery/Resend/MSG91 keys) was committed to git for 6 commits in June 2026. `SECRET-ROTATION.md` runbook exists, checklist **unchecked** — no evidence rotation happened. Now fronts a live payment rail: unrotated `NEXTAUTH_SECRET`/`JWT_SECRET` → forge an admin/dealer session → real refunds. |
| **F-21** | P1 | C/E | 🔶 | `createDelhiveryShipment` has **never succeeded in production** (0 shipments / 20 orders; the 4 that qualify are all pre-fix, June–July). Root cause: `create.json` was sent without the required `pickup_location` object until `5479ac7` (2026-08-25). Payload fixed + proven via a capture script, but no qualifying order since → the real path is **unexercised**. Failures go only to `console.error`; no `OrderEvent`, no alert. Also: no server-side pincode-serviceability check before payment (garbage pincodes like `949494` / city `oqwncn` are accepted). |
| **F-24** | P1 | D/C | ⬜ | Delhivery webhook auth is `?token=` **in the URL** (leaks to access/proxy logs); no HMAC, no event dedupe, no state-machine guard, no compare-and-swap on the `Order.status` write, two drifted status maps. A replayed/forged event can move `CANCELLED → SHIPPED` — silently un-cancelling an already-refunded order. **Blocks turning the webhook on** (currently inert — secret unset). |
| **F-26** | P1 | G | ✅ | `waitForReady` in the rate limiter leaked an ioredis `"ready"` listener + closure per call while Redis was unreachable → unbounded heap growth → worker OOM → PM2 crash-loop, dropping in-flight requests. Firing continuously since first deploy (Redis never ran). Fixed `303520a` + test. |
| **F-27** | P1 | J | 🔶 | `REDIS_URL` declared and the rate limiter hard-depends on it, but **Redis was never installed** in production. `env.ts` treats it optional; the boot log falsely printed "Rate limiter: Redis"; `/api/health(/ready)` check only the DB, so the */15 cron stayed green through the whole outage. Redis installed 2026-09-03 (operational fix); the detection gap (health check covers 1 of ≥4 dependencies) remains. |
| **F-31** | P1 | I | ⬜ | Shipped Flutter app (`v1.0.0+1`) hardcodes `kBaseUrl = 'https://motoxplus.vercel.app/api'`. The Vercel account was deleted → the host resolves to nothing → **every installed build is completely non-functional**. Production is `motoxplus.com`. |
| **F-05** | P0 | B | ✅ | `Payment → PAID` was written *before* `finalize`'s transaction; a rollback (stock sold out between capture and finalize) left the payment `PAID` with the order stuck `PENDING` forever, every webhook a no-op. Fixed `2e45a83` (write moved inside the txn; webhook returns 503 → Razorpay retries) + test. **Prod data: 0 occurrences** — real fix is W-1. |
| **F-02** | P0→ | C/B | ➖/🔶 | Cancellation fee tier read the lagging `Order.status`, not carrier state → dealer self-cancels an in-transit order at 2%. Emergency batch shipped a carrier-aware gate (`25f4797`). **Prod data: never exploitable — 0 shipments ever existed.** Keep the fix; drop the urgency. |
| **F-03** | P0 | C | 🔶 | `create.json` retry could create a second real AWB; concurrent calls could too. Retry variant fixed (`retries:1` + P2002 recovery, `25f4797`). Concurrent variant → peer branch `delhivery-auto-shipment-killswitch` (advisory lock) — under review, not merged. |
| **F-04** | P0→ | C/B | ➖/✅ | `cancelDelhiveryShipment` existed but was wired to nothing → cancel a shipped order, keep the parcel, get a refund. Batch wired it (Delhivery-cancel-first, refund only on accept). **Prod data: never reachable (0 shipments).** |

### P2

| ID | Sev | Area | Status | Summary |
|---|---|---|---|---|
| **F-06** | P2 | A | ⬜ | `admin/payments/[id]/verify\|review\|reject` accept any `STAFF` with no department check — a marketing staffer can mark any dealer payment verified → order goes to production with no money received. |
| **F-07** | P2 | B | ✅ | Concurrent refund-retry → double refund (no atomic guard). Fixed in the batch (atomic `FAILED→INITIATED` claim). |
| **F-08** | P2 | J | ⬜ | `npm audit`: 10 vulns (2 critical). `xlsx@0.18.5` prototype pollution (admin import path, no registry fix), `@auth/core` homoglyph email bypass, `next`→`postcss`, `sharp`/libvips. Exploitability of the transitive ones unassessed. |
| **F-14** | P2 | A | 🔶 | Session revocation incomplete. Bearer/mobile path **fixed** in the batch (`getAuthUser` now checks `UserSession.isActive`). Web NextAuth-cookie path → **F-18**. |
| **F-15** | P2 | A | ⬜ | `change-email` needs only a valid session (no password/OTP step-up); `user.email` updated immediately, verification OTP goes to the new (attacker) address → hijacked session → account takeover. |
| **F-17** | P2 | C | 🔶 | `normalizeShipmentStatus` has no mapping for raw `"Not Picked"` → falls through to `IN_TRANSIT` → false `Order.status = SHIPPED` for a pre-pickup parcel → cancellation over-charged 20%. Batch added a narrow guard on the tracking-sync write path; the **webhook path + the normalizer itself are still open** (Phase 3 / DB-driven status-map redesign). |
| **F-18** | P2(a)/P3(b) | A | ⬜ | Web (NextAuth-cookie) session: (a) no `UserSession` cross-check → `disable`/`reset-password`/`logout-all` don't invalidate the web session for up to 8h; (b) session lifetime is effectively unbounded (rolling JWT, web never calls refresh). Prod cohort: 11 stale-but-expired sessions. |
| **F-28** | P2 | B | ⬜ | Manual UPI/bank-transfer verification writes `Order.paymentStatus='PAID'` + an `Invoice` but **no `Payment` row** (manual payments live in `PaymentSubmission`). Confirmed in prod (`MXP35620539125`). Consequence: cancellation-with-refund of a manually-paid order **always** dead-ends to manual handling; revenue reports from the `Payment` table omit manual payments. |
| **F-29** | P2 | B/J | ⬜ | `GET /api/payments/upi/[orderId]` falls back to **hardcoded real bank account / IFSC / UPI VPA** when the `Setting` rows are absent — the opposite of the sibling `upi/qr` which fails closed. If Settings drift, dealers pay a possibly-stale account. Those identifiers are now permanently in git history. |
| **F-32** | P2 | I/B | ⬜ | Mobile checkout: `_onPaymentSuccess` swallows a failed `/payments/verify` and **always** shows "Payment successful!" + navigates away. On a genuine oversell (409) the dealer is misled; the webhook is the only backstop. |
| **F-33** | P2 | I | ⬜ | Mobile: concurrent 401s (token expiry with parallel requests) trigger multiple refresh calls racing a rotating refresh token → all but the first fail → interceptor wipes storage → **spurious logout mid-session**. |
| **S-09** | P2 | F/J | ⬜ | `next build` prerenders `/admin/staff`, `/admin/products/new`, etc. with **build-time Prisma data** → those admin pages ship with stale data until redeploy, and the build hard-fails without a reachable DB. |

### P3 (and workstreams)

| ID | Sev | Area | Status | Summary |
|---|---|---|---|---|
| **F-09** | P3 | J | ⬜ | `.gitignore` contains 6 NUL bytes (binary/corrupt, likely a PowerShell UTF-16 redirect). Parses today; fragile — a BOM-respecting edit could drop ignore rules → re-commit `.env`. |
| **F-10** | P3 | K | ⬜ | `src/lib/shiprocket/*` — ~400 LOC dead integration, no importers, creds unset. Delete. |
| **F-11** | P3 | B | ⬜ | `Order.gstAmount` (sum-then-round) can differ from Σ `OrderItem.gstAmount` (round-then-sum) by a few paise on multi-line orders; the invoice prints the header figure → line items don't foot to the total (GST-compliance nit). |
| **F-12** | P3 | A | ⬜ | `upload/payment-screenshot` checks only `role==="DEALER"`, not verified-dealer; `orderId` from form data is unvalidated in the R2 key path. |
| **F-13** | P3 | E | ⬜ | `parseInt(searchParams.get("page")||"1")` with no NaN/`<1` guard on ~every list route → `?page=x` → negative/NaN `skip` → Prisma throws → unhandled 500. |
| **F-16** | P3 | A/E | ⬜ | `auth/verify-email` is unauthenticated, takes `userId` from the body, and has **no** IP/identifier rate limit (only the per-code 5-attempt cap). Inconsistent with every sibling verify route. |
| **F-19** | P3 | E/C | ⬜ | `GET /api/shipping/serviceability` — unauthenticated, unrate-limited, one live Delhivery call per hit, `retries=3` → ×3 amplification + ~3s handler hold. Quota-burn / carrier IP-ban risk + pincode enumeration. |
| **F-20** | P3 | E/D | ⬜ | `GET /api/products/search` — unauthenticated, unrate-limited, per-request Prisma `contains` OR-scan + a `$queryRaw` full-scan of `Product.compatibility` (no GIN index) on every keystroke. DB-CPU amplification. |
| **F-23** | P3 | E/J | ⬜ | `/api/health` (public) and a few dealer/admin upload routes echo raw `err.message` — DB driver / R2 SDK error strings disclosed. |
| **F-25** | P3 | D | 📋 | Missing indexes on hot FK/filter columns (`OrderItem` has **none**; `ProductVariant.productId`; `Shipment.status`; `Review.userId`; unbounded `StorageAuditLog`). **Unblocked** now that H6 is clean — needs one migration. |
| **F-30** | P3 | D/E | ⬜ | `crm/leads/[id]/convert`, `procurement/grn`, `procurement/purchase-orders` — multi-write, **no `$transaction`**, no input validation. Partial-write states (lead un-convertible, PO status stale); `parseInt` NaN / missing FK → 500. |
| **F-22** | — | E | 📋 | Systemic: ~90 mutating routes have no shared input-validation layer. A rollout, not a finding — planned as a Phase-3 workstream. |
| **S-01** | P3 | B | ⬜ | Concurrent `admin/payments/[id]/verify` (or two UTRs for one order) → `Invoice.orderId` P2002 → unhandled 500 (only `InsufficientStockError` is caught). |
| **S-02** | P3 | A | ⬜ | `admin/payments/[id]/review\|reject` — no existence check (P2025 → 500 on bad id); `review` has no state-machine guard. |
| **S-03** | P3 | A | ⬜ | `GET /api/orders` 401s any non-DEALER/non-ADMIN → STAFF with "orders" section access can open the page but not load it. (O-1 family.) |
| **S-04** | P3 | D | ⬜ | `orders` POST clears the cart with `deleteMany` **after** the `$transaction` commits — if that fails, the order exists but the cart isn't cleared → next checkout duplicates. |
| **S-05** | P3 | E | ⬜ | `send-mobile-otp` per-identifier rate-limit key is the *target* number → rotate targets for a fresh bucket; per-account `checkResendLimit` (10/hr, DB) is the real bound. |
| **S-08** | P3 | A | ⬜ | `procurement/*` routes require `["ADMIN","SUPER_ADMIN"]` but `staff-access.ts` + nav advertise `procurement/grn` to PRODUCTION → dead nav link / broken flow. (O-1 family.) |
| **W-1** | — | B | 📋 | **Prepaid-order lifecycle workstream** (F-05 real fix): (1) reserve stock at prepaid order creation like COD does — tells the 2nd dealer "out of stock" at checkout, before payment; (2) abandoned-order reaper (auto-cancel + restock `PENDING` prepaid orders past a window — needs a GitHub Actions job); (3) bounded auto-refund after N failed finalize retries; (4) same change closes the latent bug in `admin/payments/[id]/verify` (also decrements stock post-hoc). |
| **O-1** | obs | A | ⬜ | Staff-portal nav advertises sections (`orders`→SALES, `procurement/grn`→PRODUCTION, `admin/products`→MARKETING…) whose API routes accept only ADMIN/SUPER_ADMIN → pages render with dead/erroring actions. Rate in Area H. |
| **O-2** | obs | A | ⬜ | `crm/leads/[id]/convert` requires ADMIN while the rest of CRM accepts SALES — a SALES rep can run the pipeline but not convert. Confirm intent. |
| **O-3** | obs | A | ⬜ | `admin/settings/upi` POST (the VPA dealers pay into) — single-admin, no second-approver, no audit event. |
| **O-4** | obs | A | ⬜ | Money-out routes are inconsistent: `vendors/[id]/payments` = ADMIN-only, `admin/refunds/[id]/retry` = allows ACCOUNTS. |
| **O-5** | obs | A | ⬜ | Vendor status not re-checked on `vendor/purchase-orders/[id]/accept\|reject` — SUSPENDED vendor keeps PO-response ability. |
| **O-6** | obs | A | ➖ | `GET admin/settings/upi` + `.../cancellation-policy` are intentionally public (checkout + policy page). VPA + fee % are world-readable — by design, low sensitivity. |
| **O-7** | obs | A | ⬜ | Migration `20260829000000` removed the dealer **admin-approval queue** (sign-ups auto-`ACTIVE`; still need email+mobile verification to transact). Product-confirm. |
| **O-8** | P3 | G | ⬜ | No caching strategy: `/api/vehicles` cached 24h with no invalidation; `POST /products` misses `revalidatePath`; everything else is uncached per-request Prisma. Scaling cliff, not a bug today. |
| **O-9** | P3 | I | ⬜ | Flutter minor: `loadCurrentUser` any-error→logout; `logout()` hits the web `/auth/logout`; no router `refreshListenable`; `deleteAll()` over-scoped; no deep-link review. |
| **O-10** | P3 | J | ⬜ | Backups (`backup.sh` via `backup.yml`) are **never verified restorable** and a failure only lands in a log file — no alert (same gap as F-27). `.env` parse (`grep DATABASE_URL \| xargs`) is fragile. |
| **O-11** | P3 | K | ⬜ | Remove `@cashfreepayments/cashfree-js` (dead dep); migrate the 2 `@/lib/r2` shim importers to `@/lib/storage` and delete the shim; Shiprocket per F-10. |
| **O-12** | P3 | J | ⬜ | ~40 routes + `src/lib/email/index.ts` use `console.*` directly instead of `logger`/`logError` (violates the codebase's own rule); `email/index.ts` logs recipient addresses at info. Consistency + minor PII-in-logs. |

### Resolved / refuted

| ID | Outcome |
|---|---|
| **H1** (approval bypass via API) | **Mostly refuted** — middleware doesn't cover `/api/*`, but every money/mutation route calls `getVerifiedDealer`. Residual = F-12. |
| **H4** (Float money model) | **Minor only** — Razorpay paise conversion is consistent both sides; fee/refund arithmetic is exact for 2-dp inputs. Only real issue = F-11. |
| **H5** (rate limiting) | **Confirmed → F-27** — not "misconfigured", *never provisioned*. |
| **H6** (migration drift) | **RESOLVED — no drift either direction.** Offline `migrations ↔ schema.prisma` clean; live `migrate diff --from-url` returned "empty migration". `DISASTER_RECOVERY.md` correct. **Unblocks F-25.** |
| **H7** (Shiprocket) | **Confirmed dead → F-10.** |
| **S-06** | Promoted → **F-24**. |
| **S-07** (DB is Neon?) | **Resolved** — self-hosted PostgreSQL on the VPS, not Neon. |
| **S-10** (push-WIP red tests) | **Resolved** — test mock repaired (`d21c069`); suite green (173/173 + audit's new tests). |
| **F-02 / F-04** exploit | **Never reachable in production** — 0 shipments have ever existed. Batch fixes retained; "money already lost" framing dropped. |
| **F-05** historical exposure | **Nil** — 0 orphaned PAID payments in prod. |

---

## 4. Recommended fix order, with dependencies

Sequenced so nothing is blocked when you reach it. Each row: what, why now, what it needs first.

### Wave 0 — confirm / unblock (hours, mostly not code)

| # | Item | Depends on | Notes |
|---|---|---|---|
| 0.1 | **F-01** — confirm the June secrets were rotated (Razorpay/R2/Resend/Delhivery/Neon key-creation timestamps; `NEXTAUTH_SECRET`/`JWT_SECRET` regenerated). If not, rotate now. | dashboard access | Everything downstream (forged sessions → real refunds) hinges on this. If unrotated it's the single most urgent item. |
| 0.2 | **F-27** — decide: is a missing Redis a boot failure? Move `REDIS_URL` into `REQUIRED_SERVER`, or have `instrumentation-node.ts` `redis.ping()` and log the truth. | — | Redis is up now; this stops it silently regressing. |
| 0.3 | Watch 429 rates for a few days (distributed rate limiting is now live for the first time). | Redis up (done) | Tune `RATE_LIMITS` in `rate-limit-budgets.ts` if legit dealer traffic trips `OTP_SEND perIP 8/60s` or `LOGIN perIP 20/15min`. |
| 0.4 | Confirm no other shadow deployments exist (Vercel account deleted per user — take on trust or verify DNS/registrar). | — | Closes the F-31 shadow-production angle. |

### Wave 1 — P1, ship this week

| # | Item | Depends on | Notes |
|---|---|---|---|
| 1.1 | **F-31** — repoint `kBaseUrl` → `https://motoxplus.com/api`; move to `String.fromEnvironment` + `--dart-define`; rebuild + re-release the APK; replace `motoxplus.com/downloads/motoxplus.apk`. | — | The mobile app is 100% down until this ships. Independent of everything else. |
| 1.2 | **F-21 part 2** — every `createDelhiveryShipment` failure writes an `OrderEvent` **and** surfaces to an admin-visible place (a "shipment issues" list, or an alert). | peer branch `0a3d3d8` does the `OrderEvent` half | Do this even if you don't merge the peer branch — the silent `.catch(console.error)` is why nobody knew shipping was 0%. |
| 1.3 | **F-21 part 1** — server-side pincode serviceability + sanity check in `POST /api/orders` (and gate `payments/create-order`); reject non-serviceable / implausible pincodes before payment. | `isServiceable()` already exists | Fold in F-19's caching need (serviceability calls should be cached). |
| 1.4 | **F-21 verify** — place one real qualifying order (or a staging order against live keys with `DELHIVERY_AUTO_SHIPMENT` on) and confirm an AWB is actually produced by the *production* code path (not just the capture script). | 1.2, 1.3; peer branch decision | The fix is unproven until a real order gets a real AWB. |
| 1.5 | **Peer branch `delhivery-auto-shipment-killswitch`** — decide: merge as-is (log the HTTP-in-transaction pool concern as a follow-up) or refactor to HTTP-outside-txn first. | review (done) | At ~0 orders/day, merging as-is is defensible. Revisit before real throughput. |
| 1.6 | **F-24** — Delhivery webhook hardening (one unit of work): HMAC on the raw body (not `?token=`), event dedupe, state-machine guard sharing `FULFILLMENT_TRANSITIONS`, compare-and-swap on the `Order.status` write, reconcile the two status maps (close the webhook half of F-17 here). | — | **Do not enable the Delhivery push URL until this ships.** Blocks live tracking. |

### Wave 2 — P2, this month

| # | Item | Depends on |
|---|---|---|
| 2.1 | **W-1** — prepaid-order lifecycle: reserve stock at creation + abandoned-order reaper + bounded auto-refund. Closes F-05 properly and the `admin/payments/verify` variant. | reaper needs a GitHub Actions job (no in-process scheduler) |
| 2.2 | **F-28** — write a `Payment` row on manual UPI verify (single ledger), so refunds and revenue reports work for manually-paid orders. | — |
| 2.3 | **F-14b / F-18a** — web session revocation: copy `token.sessionId` onto `session.user` in the NextAuth `session` callback, check `UserSession.isActive` in `getCurrentUserId`'s web branch. Touches every `getServerSession` call site — careful. | — (but "could take the portal down" — stage it) |
| 2.4 | **F-15** — require password or OTP step-up for `change-email`. | — |
| 2.5 | **F-06** — department check on `admin/payments/[id]/verify\|review\|reject` (route through `requireSectionAccess`). | — |
| 2.6 | **F-29** — `payments/upi/[orderId]` fail closed like `upi/qr`; scrub the hardcoded identifiers. | — |
| 2.7 | **F-32 / F-33** — mobile: check the `verify` response before "Payment successful!"; single-flight the token refresh. | ships with the F-31 rebuild |
| 2.8 | **F-08** — `npm audit` remediation (upgrade `next`/`sharp`; isolate or replace `xlsx` on the admin import path). | — |
| 2.9 | **S-09** — mark the DB-backed admin pages `dynamic`/`force-dynamic` or client-fetch; make the build not depend on a reachable DB. | — |
| 2.10 | **O-10** — backup verification (test-restore into a scratch DB in CI or a weekly job) + failure alerting. | — |

### Wave 3 — P3 cleanup / workstreams

- **F-22** — input-validation layer rollout (~90 routes). Design one `withValidation(schema)` wrapper, roll out by area.
- **F-25** — index migration (now unblocked): `OrderItem(orderId)`, `ProductVariant(productId)`, `Shipment(status)`, `Review(userId)`, cap `StorageAuditLog`.
- **F-17** (remainder) / Phase-5 DB-driven `delhivery_status_map`.
- **F-30** — wrap procurement/CRM mutations in transactions.
- **F-13, F-16, F-19, F-20, F-23** — the individual E-area instances (some fall out of F-22).
- **F-09** — rewrite `.gitignore` as clean UTF-8.
- **F-10 / O-11** — delete Shiprocket, `@cashfreepayments/cashfree-js`, the `r2.ts` shim.
- **F-11** — derive `Order.gstAmount` from the rounded per-line values.
- **O-1..O-12, S-01..S-05, S-08** — batch by area; several are one-liners (existence checks, `parseInt` guards) and several need the Area-H product calls (O-1, O-2, O-7).

### Not yet plannable — needs Area H (a running app)

- Admin RSC page query cost / N+1 in the back-office.
- O-1 / S-03 / S-08 — do the staff-portal pages 401 or render dead actions? (Determines whether these are broken flows or just cosmetic.)
- A visual / UX pass on the dealer portal and admin.

---

## 5. Coverage statement

**Covered:**
- **Area A** — all ~146 API route handlers traced at the authz/ownership/verification/rate-limit line (route matrix, `01-findings.md §4b–4d`); ~50 read in full. Auth helper modules read in full.
- **Area B** — order creation, Razorpay create/verify/webhook, manual UPI submit/verify/reject/retry, cancellation lib + routes, `finalize`, refund paths — all read in full. Float money model traced through every money step.
- **Area C** — entire `src/lib/delhivery/*` read in full; reconciled with `docs/delhivery-audit.md` / `delhivery-open-items.md` / `delhivery-reference.md`; git-archaeology on the payload bug.
- **Area D** — transaction boundaries in all money paths; `Order.status`/`Shipment.status` writer enumeration; index audit vs catalogued queries; **H6 resolved via live `migrate diff` on a prod-restored scratch DB**; procurement/CRM transaction sweep.
- **Area E** — rate-limit coverage matrix; error-handling notes; validation gap quantified (F-22).
- **Area F** — Next 15 async-params sweep; caching inventory.
- **Area G** — Redis consumer inventory (grep-complete); Next data-cache inventory.
- **Area I** — all 22 Flutter `.dart` files' relevant paths (API client, auth, checkout, router); cross-checked base URL against `.env`/`deploy.yml`/`health.yml`.
- **Area J** — `env.ts`, `instrumentation*`, `ecosystem.config.js`, health routes, `backup.sh`/`restore.sh`, secret-logging grep, `npm audit`, git-history secret scan, `.gitignore`.
- **Area K** — dead-integration confirmation (grep); dependency check.
- **Prod data (Steps 3–4)** — read-only queries against a fresh prod dump in a scratch DB: F-05 occurrence check, shipment/order state, cancellation sets, session cohort, `MXP35620539125`; migration diff both directions.

**Not covered:**
- **Area H** (web UI / running app) — no DB or tunnel in the audit environment. This is the one material gap.
- A dedicated performance pass (EXPLAIN ANALYZE at scale).
- The admin vehicle-CMS route tree (~40 routes) — spot-checked only (all go through `requireAdmin()` = `["ADMIN","SUPER_ADMIN"]`); assumed uniform.
- Client-side React components beyond the action-components and checkout.

**Numbers:** ~146 API routes · 66 Prisma models · 30 enums · 7 migrations · 22 Flutter files · 173 passing tests (+ audit additions) · findings F-01…F-33, S-01…S-10, O-1…O-12, W-1.

---

## 6. Not verifiable without more access

| Item | What it needs |
|---|---|
| Whether the F-01 leaked secrets were actually rotated | Razorpay / R2 / Resend / Delhivery / Neon dashboard key-creation timestamps, or `NEXTAUTH_SECRET`/`JWT_SECRET` history |
| Area H — admin page query cost, staff-nav behaviour, UX | The app running against a database (local DB or a tunnel to the scratch/prod DB) |
| Whether the fixed `createDelhiveryShipment` actually produces an AWB | A real qualifying order (or staging + live keys) placed through the production code path — none exists post-fix |
| Whether `motoxplus.vercel.app` / any other deployment is truly gone | DNS / registrar / Vercel-org check (user states the Vercel account is deleted — taken on trust) |
| The peer branch's "189 tests pass" | Running that branch's suite (reviewed the diff, did not run it) |
| Real N+1 / query-plan cost | `EXPLAIN ANALYZE` against prod-scale data |
| `npm audit` transitive-CVE exploitability (F-08) | Dependency-path analysis / upstream advisories |
| Carrier-side AWB orphans (F-03 residual) | Delhivery account reconciliation — invisible from our DB |
| Whether `DELHIVERY_WEBHOOK_SECRET` should be generated now | Product/ops decision + Delhivery-side push-URL config (blocked on F-24 regardless) |

---

## 7. Confidence notes

- **High confidence:** F-01, F-05, F-21 (root cause), F-24, F-26, F-27, F-31, H6-resolved, the "0 shipments / F-02-F-04 never reachable" conclusion — all directly verified in code, git history, or prod data.
- **Medium:** F-08 (audit output, not exploit-tested), F-17 remainder (webhook path dormant), F-32/F-33 (Flutter code read, not run), the peer-branch pool concern (analysis, not load-tested).
- **Lower / needs Area H:** O-1, S-03, S-08 (broken flow vs cosmetic — undetermined), admin page perf.
- **Taken on trust from the user:** Vercel account deleted (F-31 shadow-prod angle); `RAZORPAY_WEBHOOK_SECRET` set in prod; scratch-DB was a faithful prod restore.
