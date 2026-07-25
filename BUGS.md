# MotoXPlus — Bug & Security Audit

Full-codebase pass covering: hardcoded credentials, OTP brute-force/spam, SQL injection,
session/CORS validation, IDOR, OTP edge cases, error handling, cart/order money-correctness,
performance/SEO, and a responsive-design code review. Items marked **[FIXED]** were patched
in this pass; items marked **[DOCUMENTED]** were found but intentionally left for you to
decide on (bigger scope, product-decision needed, or unverifiable without a running browser).

---

## Critical

### 1. Hardcoded JWT signing-secret fallback — `src/lib/auth/jwt.ts:4` — [FIXED]
```ts
process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || "fallback-secret-change-in-production"
```
If both env vars were ever unset (misconfigured deploy, typo'd var name, a container that
booted before secrets were injected), every access/refresh token for the custom JWT auth
system (used by the mobile app and any Bearer-token client) would be signed with this
**public, literal string baked into the repo**. Anyone who read the source could forge a
valid token for any `userId`/`role` — including admin — and fully take over any account.
`src/lib/env.ts` does validate `JWT_SECRET` is set and throws in production, but only for
code paths that import `env.ts`/`prisma.ts` first — `jwt.ts` never imported it and read
`process.env` directly, so the safety net wasn't guaranteed.
**Fix:** removed the fallback; the module now throws immediately if no secret is configured,
instead of silently signing with a known value.

### 2. Razorpay online payment was completely non-functional — `src/app/dealer/checkout/page.tsx` — [FIXED]
`/api/payments/create-order` wraps its response in `{ data: {...} }` (via the `ok()` helper
in `src/lib/api.ts`), but the checkout page read fields directly off the top-level object:
`rzpData.keyId`, `rzpData.amount`, `rzpData.razorpayOrderId` were all `undefined`. Every
dealer who picked **"Full Payment via Razorpay"** or **"20% Advance via Razorpay"** would
have had `new window.Razorpay({ key: undefined, amount: undefined, ... })` — the SDK either
throws (caught, showing a generic "Something went wrong") or opens a modal that can't
process a real payment. Only Cash-on-Delivery and Direct UPI were actually usable.
**Fix:** read the payload from `rzpData.data`, and added a check that surfaces the real
server error (e.g. "No payment due on this order") if the request failed, instead of
silently trying to open Razorpay with garbage values.

---

## High

### 3. OTP login endpoint had no per-phone resend cap — `src/app/api/auth/login-otp/route.ts` — [FIXED]
The send-OTP step only called `checkIPRateLimit(ip, 5, 60)` (5 requests/60s **per IP**) and
never called `checkResendLimit` (the per-account/phone hourly cap that `send-mobile-otp` and
`forgot-password` both already had). An attacker rotating IPs — or simply waiting out the
60-second window — could send unlimited login OTPs to a victim's phone, burning SMS credits
indefinitely. This was the concrete answer to "can someone spam OTPs to burn my API costs":
yes, via this one endpoint.
**Fix:** added `checkResendLimit(user.id, "LOGIN")`, capping it at 5 sends/hour like the
other OTP flows.

### 4. In-memory rate limiter was multiplied by CPU core count in production — `src/lib/auth/rate-limit.ts` — [FIXED]
`ecosystem.config.js` runs PM2 with `exec_mode: "cluster", instances: "max"` — one Node
process per CPU core. The IP rate limiter used a plain in-process `Map`, so each worker had
its own independent counter. On a 4-core box, "5 requests/60s per IP" was actually
~20 requests/60s, since requests round-robin across workers that don't share state. This
silently weakened *every* IP-based rate limit in the app (login, OTP, registration, contact
form), not just OTP.
**Fix:** added a Redis-backed limiter (`src/lib/redis.ts`, atomic Lua `INCR`+`EXPIRE` script
in `rate-limit.ts`) that activates automatically when `REDIS_URL` is set — shared across all
workers — falling back to the old in-memory behavior if Redis isn't configured or errors.
**Action needed from you:** set `REDIS_URL` in production for this to take effect; without
it, the app still runs (falls back to in-memory) but the multiplier problem remains.

### 5. IDOR: any dealer could delete any other dealer's cart item — `src/app/api/cart/route.ts` (DELETE) — [FIXED]
```ts
await prisma.cartItem.delete({ where: { id: itemId } });
```
The handler looked up the caller's own cart but never checked that `itemId` actually
belonged to it before deleting — it deleted by item ID alone, globally. Cart item IDs are
CUIDs (not practically guessable), which limited real-world exploitability, but this is a
textbook IDOR: authorization was never checked, only existence.
**Fix:** changed to `deleteMany({ where: { id: itemId, cartId: cart.id } })` and return 404
if nothing matched.

### 6. Hardcoded company UPI payment ID fallback — `src/app/api/payments/upi/qr/route.ts` — [FIXED]
```ts
const upiId = upiIdSetting?.value || "5118678468276SB1024@mairtel";
```
If the `upi_id`/`upi_name` rows in the `Setting` table were ever missing (e.g. a botched
migration, a settings-page bug that deleted the row), the QR endpoint would silently fall
back to this hardcoded VPA baked into source control, rather than failing visibly — real
customer payments could be quietly directed at a stale/wrong UPI ID with no error anywhere.
**Fix:** removed the hardcoded fallback; the endpoint now returns `503` with a clear message
if the setting isn't configured (fail closed, matching the pattern already used for the
Delhivery webhook secret). Also added missing rate limiting and amount validation.

### 7. Checkout never re-validated stock or active status — `src/app/api/orders/route.ts` — [FIXED]
Cart items are added when a product is active and in stock, but nothing re-checked either
condition at order-creation time (which can be hours/days later). A product going
out-of-stock or being deactivated after it was added to cart could still be ordered.
(Price, by contrast, was already correct — it's read fresh from the product/variant at order
time, never cached in the cart, so price-drift between add-to-cart and checkout is **not**
a bug here.)
**Fix:** added a check before order creation that rejects (409) with the specific
unavailable product IDs if any cart item's product/variant is inactive or `stock <
quantity`. Note: stock is not auto-decremented on order creation (nothing in the codebase
currently does this — it looks like it's managed manually / via the procurement-GRN flow),
so this is a defensive re-check, not a reservation system; a race between two dealers
checking out the last unit simultaneously is still possible and would need row-level locking
or a stock-decrement-on-order step to fully close.

### 8. Unhandled promise rejections in checkout → infinite spinner, including after a successful payment — `src/app/dealer/checkout/page.tsx` — [FIXED]
- `handleCOD` and `handleDirectUpi` had no try/catch at all. A network failure or a non-JSON
  error response (e.g. a proxy's HTML 502 page) would throw inside `.json()`, which — since
  nothing caught it — left `setLoading(true)` stuck forever with zero user feedback. The
  click just silently did nothing.
- `handleOnlinePayment`'s outer try/catch only wrapped the code that opens the Razorpay
  modal — the `handler` callback Razorpay invokes *after* payment succeeds is a separate
  async function outside that try/catch. If the follow-up call to `/api/payments/verify`
  threw (network blip), the customer's money was already captured by Razorpay, but the app
  showed nothing and never reset the loading state — a paying customer left staring at a
  spinner with no idea if their order went through.
**Fix:** wrapped all three handlers properly, added a `safeJson` helper so a non-JSON
response can't throw uncaught, used `finally` to guarantee `setLoading(false)`, and — for
the post-payment verify failure specifically — show an explicit "your payment went through,
contact support with this order number, don't pay again" message instead of nothing.

### 9. No error boundary anywhere in the App Router — `src/app/` — [FIXED]
There was no `error.tsx` (or `global-error.tsx`) anywhere in the app. Any uncaught render
error in a page would fall through to Next.js's bare default error UI in production — no
navigation, no retry, no branding, effectively a dead end for the user.
**Fix:** added `src/app/error.tsx` (segment-level boundary with a "Try again"/"Go home" UI)
and `src/app/global-error.tsx` (catches errors thrown by the root layout itself, which a
regular `error.tsx` can't).

---

## Medium

### 10. User enumeration via forgot-password — `src/app/api/auth/forgot-password/route.ts` — [FIXED]
The code's own comment said "Always return success to prevent user enumeration," but the
non-existent-account branch returned a **different message** ("If this account exists...")
than the real-account branch ("OTP sent successfully"), and only echoed a real `userId` when
the account existed. Trivial to probe any email/phone for a registered account.
**Fix:** both branches now return the identical generic message. Residual limitation: the
verify step (`verify-forgot-password-otp`) takes `userId` directly from the client, so the
success response still has to return the real ID for the flow to work — full anonymity
would need an opaque-token redesign, which I did not do here (bigger architectural change,
flagged for you to decide on). The message/shape are at least now indistinguishable.

### 11. Unauthenticated email-verification-resend let anyone probe/spam any address — `src/app/api/auth/send-email-verification/route.ts` — [FIXED]
Took an arbitrary `userId` or `email` in the body with no auth check, and returned distinct
`404`/`400`/`200` outcomes depending on whether the account existed and was verified — an
oracle for enumerating registered emails, plus an unauthenticated way to repeatedly email
third parties (bounded only by the per-account resend cap).
**Fix:** now always returns the same generic response regardless of outcome; the resend cap
still limits actual sends per account.

### 12. `verify-forgot-password-otp` had no IP rate limit — `src/app/api/auth/verify-forgot-password-otp/route.ts` — [FIXED]
Guessing was already bounded by the OTP model itself (3 attempts/code, checked in
`src/lib/auth/otp.ts`), but the endpoint had no throttle of its own, unlike every sibling
OTP route. Added `checkIPRateLimit` for defense in depth and consistency.

### 13. Phone number normalization rejected valid formats — `src/lib/phone.ts` (new) — [FIXED]
The old inline logic (`mobile.replace(/\s/g, "").replace("+91", "")`, duplicated across 6
routes) only stripped a literal `+91` prefix:
- `"919876543210"` (country code, no `+`) → stayed 12 digits → rejected as invalid.
- `"09876543210"` (leading 0, a common landline-dialing habit) → stayed 11 digits → rejected.
- `"+91 98765 43210"` / with spaces → worked correctly already.
**Fix:** added `normalizeIndianMobile()` in `src/lib/phone.ts`, handling `+91`, bare `91`
prefix, a leading `0`, and embedded spaces/hyphens; applied it in `send-mobile-otp`,
`login-otp`, `forgot-password`, replacing the ad-hoc duplicated logic. (`register`,
`login`, and `mobile/auth/login` still use the old inline pattern — same latent bug, lower
priority since those are password-based flows where a rejected format just means "try
again," not a silent OTP failure; consider swapping them to the shared helper too.)

### 14. Floating-point rounding drift in order/GST totals — `src/app/api/orders/route.ts`, `src/app/api/payments/verify/route.ts` — [FIXED]
`Order.subtotal/gstAmount/grandTotal/amountDue` etc. are Prisma `Float` columns (binary
double), and the totals were summed via `unitPrice * quantity * gstRate / 100` across all
cart items with no rounding at any point — classic floating-point drift (e.g.
`1234.5600000000004`) that compounds with more items. `OrderItem.total` was also computed
via a second, independent expression (`unitPrice * qty * (1 + gstRate/100)`) that can
diverge from `subtotal + gstAmount` by a floating-point epsilon even though they're
mathematically the same value.
**Fix:** added `roundToPaise()` in `src/lib/utils.ts` and applied it at every computation
step (subtotal, gstAmount, grandTotal, amountDue, per-item gstAmount/total in
`orders/route.ts`; the partial-payment remaining-balance calc in `payments/verify/route.ts`).
Per-item `total` is now derived from the already-rounded `gstAmount` instead of its own
separate expression, so the two can't drift apart. Note: this doesn't fix the underlying
`Float`-vs-`Decimal` schema choice (a bigger migration), just prevents the drift from
accumulating in what's stored/charged.

### 15. Delhivery webhook token compared with `!==` instead of constant-time — `src/app/api/webhooks/delhivery/route.ts` — [FIXED]
Low practical risk over a real network (timing noise dwarfs the signal), but constant-time
comparison is free once you're touching the code. Added `crypto.timingSafeEqual` via a small
`tokenMatches()` helper, used in both the `POST` and `GET` handlers.

---

## Low / Documented, not fixed

### 16. Dealer self-service account deletion has no re-confirmation step — `src/app/api/dealer/account/route.ts`
`DELETE` permanently removes the user, dealer, all orders, invoices, and cart with a single
unauthenticated-beyond-session request — no re-entered password, no confirmation token. Not
one of the specific security questions asked, and fixing it is a UX decision (add a
password-confirm field? an email confirmation link? a 24h undo window?) I didn't want to
make unilaterally. Flagging for a decision.

### 17. A few raw `<img>` tags outside next/image in admin/dealer-internal pages
`product-variant-manager.tsx`, `diagram-manager.tsx`, admin/dealer order detail pages, and
one small (8×8px) search-suggestion thumbnail in `product-catalog.tsx`. None of these are on
customer-facing/SEO-indexed pages, so left as-is — low priority. The customer-facing product
grid and product detail pages already use `next/image` throughout.

### 18. Responsive design — code-reviewed only, not visually verified
I don't have a browser available in this environment, so I could not actually load the site
at 360px and look for overlap/overflow/tap-target issues as asked. I did a targeted code
scan (hardcoded pixel widths, missing `overflow-x` handling) across product/cart/checkout/
OTP components and found nothing alarming — the one large `min-w-[500px]` table (product
compare view) is correctly wrapped in `overflow-x-auto`. This is not the same as visual
verification. Recommendation: run `npm run dev` and check with the browser devtools
responsive mode, or use the `playwright` devDependency already in `package.json` to script
a 360px screenshot pass across the key pages — I'd want to actually see the renders before
claiming this is fixed.

### 19. Error-handling sweep — done for the highest-risk path, not exhaustively for all ~146 API routes/every frontend fetch call
I went deep on the checkout flow specifically (found bug #8 above, the most consequential
one — real money involved) and spot-checked patterns (`.catch(() => {})` with no logging,
missing error boundaries) across the rest of the app. I did not individually re-verify every
API route and every frontend `fetch` call by hand — that's a genuinely large surface (146
API routes) and doing it superficially would just produce noise. If you want, I can do a
second, narrower pass focused specifically on admin/vendor/procurement flows next.

---

## Verified — investigated, found to already be correct (no action taken)

- **SQL injection**: all `$queryRaw` usage (in `src/lib/product-search.ts`, health checks) uses
  tagged-template literals, which Prisma parameterizes automatically — none of it is string
  concatenation. No injection risk found anywhere in the codebase.
- **CORS**: no `Access-Control-Allow-Origin` or permissive CORS config anywhere — this is a
  same-origin Next.js app (frontend + API share one origin), so there's nothing to
  misconfigure here. Not a vulnerability.
- **Session/token validation**: the custom JWT system (`src/lib/auth/jwt.ts` +
  `current-user.ts`) checks the DB (`UserSession.isActive` + `expiresAt`) on every request,
  not just the JWT signature — so revoking a session actually takes effect immediately.
  NextAuth sessions are capped at 8h in production. Both look solid.
- **OTP resend invalidation**: requesting a new OTP does mark all previous unused OTPs of
  that type as `used` (`src/lib/auth/otp.ts`, `createOTP`) — the old code stops working the
  moment a new one is issued, as expected.
- **OTP brute force**: capped at 3 wrong attempts per code (then the code is burned), and
  (after fix #3) at most 5 new codes/hour per account across all OTP flows — roughly 15
  guesses/hour against a 6-digit code, a non-issue.
- **OTP expiry**: enforced server-side against `expiresAt` in Postgres, not client-trusted.
- **Server restart mid-OTP-flow**: OTP codes are stored in Postgres (`OtpCode` table), not
  in memory, so a server/PM2 restart does not lose in-flight OTPs or crash the verify step —
  only the IP rate-limit counters were ever in-memory (fixed by #4).
- **Cart quantity validation**: quantity `< 1` rejected, and quantity must be an exact
  multiple of the product's MOQ — negative, zero, and fractional quantities are all already
  rejected.
- **Cart "add same product twice"**: keyed on `(cartId, productId, variantId)` and updates
  the existing row's quantity rather than creating a duplicate line — by design the quantity
  selector represents the *desired total*, not a delta, which is intentional/safe (avoids
  accidental double-add from a duplicate click).
- **GST calculation consistency**: frontend (checkout display) and backend (order creation)
  use the identical formula against the same live product/variant data — no drift between
  what's shown and what's charged, beyond the floating-point issue fixed in #14.
- **No hardcoded WhatsApp Cloud API token**: there's no WhatsApp Business/Cloud API
  integration in this codebase at all — OTPs go out via SMS providers (MSG91/Twilio/
  Fast2SMS, selected by `SMS_PROVIDER`), and the WhatsApp references in the UI are just a
  static "chat with us" link built from the public `NEXT_PUBLIC_COMPANY_WHATSAPP` number, not
  an API integration with credentials to leak.
- **Performance/SEO fundamentals**: product listing (`/products`) and product detail pages
  are server-rendered (data fetched in an `async` Server Component and passed down), not
  client-fetched — so this is not a "Google can't index client-only content" situation.
  Product detail pages already carry a thorough JSON-LD `Product` schema (offers, price,
  availability, aggregateRating) plus site-wide `Organization`/`WebSite` schema in the root
  layout. `next.config.mjs` already sets a real CSP, HSTS, and correct cache headers. The
  customer-facing product grid/detail pages already use `next/image` throughout.

---

## Summary

| Severity | Found | Fixed | Documented only |
|---|---|---|---|
| Critical | 2 | 2 | 0 |
| High | 7 | 7 | 0 |
| Medium | 6 | 6 | 0 |
| Low | 4 | 0 | 4 |

Fixed items were verified with `tsc --noEmit` (no new type errors introduced beyond
pre-existing, unrelated ones in `prisma/seed-cables.ts`, `vendor/products/route.ts`, and
`product-import.ts`). None of the fixes were run against a live database, Redis instance, or
browser — recommend a staging smoke test (register → OTP → login → add to cart → checkout
via each of the 3 payment types → admin payment verification) before deploying.
