# Secret Rotation Runbook

**This document contains zero real secret values — placeholders only.** Do not
paste real values into this file, into commit messages, or into any script
output. Every value below is generated/copied directly between the issuing
dashboard and the server's `.env` file, never through this repo.

## Why every one of these is in scope

`.env` was committed to this repo in commits `d2bdf8b..096671d` before being
untracked in `096671d`. Untracking does **not** remove it from history — every
blob is still reachable via `git log`, reflogs, and any existing clone/fork.
Per standard incident handling: **anything that was ever in a committed
`.env` is permanently compromised and must be rotated, regardless of whether
history is later scrubbed.** History scrubbing (optional, see §6) is hygiene
for the future, not a substitute for rotation.

Additionally: `src/lib/prisma.ts` logged the full `DATABASE_URL` on every cold
start (now fixed), and `src/lib/auth/jwt.ts` briefly carried a hardcoded JWT
signing fallback (introduced in commit `d879bf5`, removed in `6846aef`, now
`HEAD` has none — see `src/lib/auth/jwt.ts`'s comment for the fix). The
fallback string itself is not reproduced anywhere below; rotating
`JWT_SECRET` (item 2) fully neutralizes it since any token signed with any
prior key — hardcoded or not — stops verifying once the signing key changes.

## Credential inventory (names only, scanned from `.env` blobs in commits `d2bdf8b`…`d879bf5`)

| Variable | Ever in git history? | Rotation needed |
|---|---|---|
| `DATABASE_URL` (Postgres password) | Yes | **Yes — §1** |
| `NEXTAUTH_SECRET` | Yes | **Yes — §2** |
| `JWT_SECRET` | Yes | **Yes — §2** |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | Yes | **Yes — §3** |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Yes | **Yes — §3** |
| `RESEND_API_KEY` | Yes | **Yes — §4** |
| `DELHIVERY_API_TOKEN` | Yes | **Yes — §5** |
| `DELHIVERY_WEBHOOK_SECRET` | Yes | **Yes — §5** |
| `MSG91_AUTH_KEY` | Yes | **Yes — §6** |
| `TWILIO_AUTH_TOKEN` (+ `TWILIO_ACCOUNT_SID`) | Yes | **Yes — §6** |
| `FAST2SMS_API_KEY` | Yes | **Yes — §6** |
| `REDIS_URL` | Yes | **Yes — §7** |
| `SHIPROCKET_EMAIL` / `SHIPROCKET_PASSWORD` | **No — not found in any historical `.env` blob** | Not a leak; see §8 (net-new credential for the Shiprocket integration being built alongside this runbook) |
| WhatsApp Cloud API token | **No — no such variable exists anywhere in git history or the current `.env.example`** | N/A — see note in §8 |
| `NEXTAUTH_URL`, `NEXT_PUBLIC_*`, `EMAIL_FROM`, `SMS_PROVIDER`, `MSG91_SENDER_ID`, `MSG91_FLOW_ID`, `DELHIVERY_BASE_URL`, `DELHIVERY_ORIGIN_PINCODE`, `DELHIVERY_PICKUP_*` | Yes | No — public/non-sensitive config, not credentials |
| `ENCRYPTION_KEY` | **No — not present in any historical `.env` blob** (added after the leak window) | Not compromised; no action needed |

**Correction to note:** the task brief assumed Shiprocket and WhatsApp Cloud
API credentials might be in the leaked `.env`. They are not — the only
shipping/SMS providers ever configured in this repo are **Delhivery** (shipping)
and **MSG91 / Twilio / Fast2SMS** (OTP/SMS). Rotation steps for those real,
leaked credentials are included (§5, §6); Shiprocket is covered separately in
§8 as new-credential setup, not rotation-due-to-leak.

---

## Ground rules before starting

- [ ] 0.1 Do this during a low-traffic window if possible (late night IST) — a few of these (DB password, Shiprocket password) have a brief hard-cutover window.
- [ ] 0.2 Open an SSH session to the Hostinger VPS and a local password manager / secure notes app. Every new value gets typed directly from its issuing dashboard into `.env` on the VPS, or generated on the VPS itself with `openssl` — never drafted in this repo, a commit message, or a chat window.
- [ ] 0.3 Take a copy of the current (untracked) `.env` on the VPS as `.env.pre-rotation-backup` (`cp .env .env.pre-rotation-backup`, `chmod 600` it) in case a rollback is needed mid-cutover. Delete it once §9 verification passes.
- [ ] 0.4 Confirm PM2 cluster identity before touching anything: `pm2 status` should show a single app named `motoxplus` in `cluster` mode. All rotation below assumes exactly one restart at the very end (§9), via `pm2 reload ecosystem.config.js --env production`.

---

## §0b — Break-glass: force-log-out every web session immediately (F-14a)

Use this when a web account (admin/staff/dealer/vendor panel) must lose access
**now** and you cannot wait — a compromised admin session, a terminated employee,
a leaked laptop.

**Why it's needed:** `admin/users/[id]/disable`, `logout-all`, and the
password-reset routes call `revokeAllSessions()`, which flips
`UserSession.isActive = false`. As of the 2026-08-28 emergency batch that
reliably cuts off **Bearer/mobile** clients (and web clients within 15 min of
login). It does **not** yet cut off an established **web** (NextAuth-cookie)
session — `getServerSession` has no `UserSession` cross-check (finding **F-18**
in `AUDIT/01-findings.md`; fix scheduled for Phase 3). A disabled web dealer/admin
keeps portal + `getServerSession`-gated API access until their NextAuth cookie
hits its `maxAge` (8 h in production, rolling).

**Break-glass procedure — rotating `NEXTAUTH_SECRET` invalidates every web
session in the process, instantly:**

- [ ] 0b.1 Generate a new value: `openssl rand -base64 32`
- [ ] 0b.2 On the VPS, edit `.env`, replace `NEXTAUTH_SECRET` only.
- [ ] 0b.3 `pm2 reload ecosystem.config.js --env production`
- [ ] 0b.4 Confirm: an existing web session cookie now bounces to `/login`.

**Cost:** every web user (all panels) is signed out and must log in again — see
§2's "what breaks" notes. Mobile/Bearer clients are unaffected (they verify
against `JWT_SECRET`, not `NEXTAUTH_SECRET`). This is a blunt instrument; for a
single account, prefer `disable` + this only if the 8 h residual window is
unacceptable. Once F-18 lands, `disable` alone will be sufficient and this
section becomes redundant.

---

## §1 — Postgres password (Hostinger VPS, `postgresql@16-main`) + `DATABASE_URL`

**Issued/changed:** directly on the VPS via `psql`, not a third-party dashboard.

Steps (run as the `postgres` superuser or a role with `ALTER ROLE` rights on the app's DB user):

- [ ] 1.1 Generate a new password and hold it in your password manager: `openssl rand -base64 24`
- [ ] 1.2 Connect: `sudo -u postgres psql`
- [ ] 1.3 Rotate: `ALTER ROLE motoxplus WITH PASSWORD '<NEW_PASSWORD>';` (use the actual app DB role name if different from `motoxplus`)
- [ ] 1.4 Exit `psql`. **Do not restart the `postgresql@16-main` service** — `ALTER ROLE ... PASSWORD` takes effect immediately for new connections; existing pooled connections in the running Next.js processes keep working on their already-authenticated sessions until they cycle.
- [ ] 1.5 Build the new `DATABASE_URL` value (same host/port/db name, new password) and stage it for the single `.env` edit in §9 — do not edit `.env` yet if you're batching this with other credentials below.

**What breaks during the swap:** nothing until `.env` is updated and PM2 reloads (§9) — existing connections are unaffected by the password change itself. After the reload, any Next.js worker that hasn't picked up the new `DATABASE_URL` yet (i.e., if you reload before finishing step 1.3, or edit `.env` with a typo) will fail every DB query with an auth error. Keep 1.3 and the `.env` edit close together in time so the window where old `.env` + new password coexist is short.

**Verify after §9 reload:**
- [ ] 1.6 `pm2 logs motoxplus --lines 50` — no `password authentication failed` or Prisma connection errors.
- [ ] 1.7 Hit any page that reads from the DB (e.g. the homepage product list) and confirm it loads.

---

## §2 — `JWT_SECRET` and `NEXTAUTH_SECRET` (generate fresh, 32+ bytes)

**Issued/changed:** generated locally, not from any third-party dashboard.

- [ ] 2.1 Generate both, independently (never reuse one for the other — see the comment in `src/lib/auth/jwt.ts` explaining why `JWT_SECRET` and `NEXTAUTH_SECRET` must stay two distinct values):
  ```
  openssl rand -base64 32   # for JWT_SECRET
  openssl rand -base64 32   # for NEXTAUTH_SECRET
  ```
- [ ] 2.2 Stage both new values for the single `.env` edit in §9.

**What breaks during the swap:**
- `JWT_SECRET`: every currently-issued access/refresh token (mobile app + any Bearer-token API client) fails `verifyAccessToken`/`verifyRefreshToken` the instant the new secret is live — there is no dual-key grace period in `src/lib/auth/jwt.ts`. **All mobile app users are forced to log in again**, immediately and simultaneously, at the PM2 reload in §9.
- `NEXTAUTH_SECRET`: every NextAuth web session (admin/staff/dealer/vendor panel logins) is invalidated the same way — everyone logged into the web app is signed out at the reload.
- Both are one-time, unavoidable costs of this rotation — there's no way to rotate a signing secret without invalidating everything signed by the old one. Plan the reload for low-traffic hours.

**Verify after §9 reload:**
- [ ] 2.3 Log into the web admin panel — should require fresh credentials (old session cookie should NOT work).
- [ ] 2.4 From the mobile app (or a Bearer-token test client), confirm a stale access token is now rejected (401) and a fresh login succeeds and issues a working token.

---

## §3 — R2 (Cloudflare) and Razorpay API keys

**Issued/changed:**
- R2: Cloudflare dashboard → R2 → Manage R2 API tokens.
- Razorpay: `dashboard.razorpay.com` → Settings → API Keys.

- [ ] 3.1 In Cloudflare: create a **new** R2 API token scoped only to the `motoxplus-assets` bucket (Object Read & Write) — do not revoke the old one yet.
- [ ] 3.2 In Razorpay: generate a **new** key pair (Razorpay lets you have the old and new key active simultaneously) — do not revoke the old one yet. Note current state: `.env.example` ships `NEXT_PUBLIC_RAZORPAY_ENABLED="false"` (Razorpay not yet onboarded on the merchant account) — if still disabled/test-mode in production, this is lower urgency but still rotate for hygiene since a real key pair did appear in the leaked history from the very first commit.
- [ ] 3.3 Stage `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `NEXT_PUBLIC_RAZORPAY_KEY_ID` (same value as `RAZORPAY_KEY_ID` — it's the public half) for the single `.env` edit in §9.

**What breaks during the swap:** nothing until §9 — both providers support old+new keys live simultaneously, so there's no cutover race. After §9's reload, **do not revoke the old R2/Razorpay credentials yet** — revoke only after §9's verification passes (§10), so a bad new value doesn't leave you locked out of both at once.

**Verify after §9 reload:**
- [ ] 3.4 Upload a test image (any admin upload form) and confirm it lands in R2 and is publicly reachable at the `R2_PUBLIC_URL`.
- [ ] 3.5 If Razorpay is enabled: place a small test/live payment through checkout and confirm the order completes and the webhook (`src/app/api/webhooks/razorpay/route.ts`) processes it.

---

## §4 — `RESEND_API_KEY`

**Issued/changed:** `resend.com/api-keys`, scoped to the `motoxplus.in` sending domain.

- [ ] 4.1 Create a **new** Resend API key (old one keeps working until you revoke it).
- [ ] 4.2 Stage `RESEND_API_KEY` for the single `.env` edit in §9.

**What breaks during the swap:** nothing until §9 reload — Resend supports multiple live keys, so update-then-revoke avoids any gap. If you revoke the old key before confirming the new one works, all transactional email (dealer/vendor verification, order confirmations, contact-form replies) fails silently in the background (these are fire-and-forget `.catch(console.error(...))` calls per `src/lib/email/index.ts` — failures don't surface to the user, only to PM2 logs).

**Verify after §9 reload:**
- [ ] 4.3 Use the existing admin test-email route/page (`src/app/api/admin/test-email/route.ts`) to send a test email and confirm delivery.
- [ ] 4.4 Only then revoke the old Resend key (§10).

---

## §5 — Delhivery (`DELHIVERY_API_TOKEN`, `DELHIVERY_WEBHOOK_SECRET`)

**Issued/changed:**
- `DELHIVERY_API_TOKEN`: Delhivery partner portal.
- `DELHIVERY_WEBHOOK_SECRET`: generated locally (`openssl rand -hex 32`), configured on both sides (`.env` and wherever Delhivery's webhook-signing is registered for this account).

- [ ] 5.1 In the Delhivery partner portal, regenerate the API token.
- [ ] 5.2 Generate a new webhook secret: `openssl rand -hex 32`.
- [ ] 5.3 Update the webhook secret on the Delhivery side (wherever their webhook config lives for this account) to match.
- [ ] 5.4 Stage both for the single `.env` edit in §9.

**What breaks during the swap:** Delhivery API tokens are typically single-active (regenerating invalidates the old one immediately) — so between 5.1 and the §9 reload, live calls in `src/lib/delhivery/client.ts` (tracking sync, shipment creation, serviceability checks) will 401 (`DELHIVERY_AUTH_ERROR`, thrown immediately without retry per that file). Keep 5.1 and §9 close together. The webhook secret: until both sides agree, `src/app/api/webhooks/delhivery/route.ts` will reject incoming webhook calls — inbound tracking-status updates queue up on Delhivery's side and typically retry, but confirm this isn't a long gap.

**Verify after §9 reload:**
- [ ] 5.5 Trigger a tracking sync for an existing shipment and confirm no `[Delhivery] tracking fetch failed` in `pm2 logs motoxplus`.
- [ ] 5.6 Confirm a Delhivery webhook call is accepted (check for a processed event, not a 401/403, in the logs or `ShipmentTrackingEvent` table).

---

## §6 — SMS/OTP providers (`MSG91_AUTH_KEY`, `TWILIO_AUTH_TOKEN` + `TWILIO_ACCOUNT_SID`, `FAST2SMS_API_KEY`)

**Issued/changed:**
- MSG91: `control.msg91.com` → API keys.
- Twilio: `console.twilio.com` → Account → API keys & tokens (Auth Token is regenerated as a pair with the Account SID staying fixed — confirm Account SID hasn't itself changed).
- Fast2SMS: `fast2sms.com` dashboard → Dev API.

Only `SMS_PROVIDER`'s active provider is live in `src/lib/sms/index.ts` (defaults to `msg91` if unset) — but rotate all three that ever appeared in history, since inactive ones are still valid, callable credentials sitting in old commits.

- [ ] 6.1 Regenerate the MSG91 auth key.
- [ ] 6.2 Regenerate the Twilio auth token (keep the Account SID as-is unless it's also being rotated).
- [ ] 6.3 Regenerate the Fast2SMS API key.
- [ ] 6.4 Stage all for the single `.env` edit in §9.

**What breaks during the swap:** whichever provider `SMS_PROVIDER` currently selects will fail OTP/SMS sends between "regenerate" and the §9 reload — `src/lib/sms/index.ts` has a **dev-only** fallback (logs the OTP to console instead of sending) that only triggers when `MSG91_AUTH_KEY` is entirely unset or the template ID is a placeholder, not when a regenerated key is simply wrong; a stale key in `.env` after regeneration will hard-fail sends with a provider API error, not silently log the code. Minimize the gap between regenerating and the `.env` update in §9.

**Verify after §9 reload:**
- [ ] 6.5 Trigger a real OTP send (e.g. dealer login) and confirm receipt on a real phone.
- [ ] 6.6 Check `pm2 logs motoxplus` for SMS provider errors.

---

## §7 — `REDIS_URL`

**Issued/changed:** on the VPS, via `redis-server`'s config (`requirepass`) if this Redis instance uses auth; check current config with `redis-cli CONFIG GET requirepass` (returns the value — run this only if you're prepared to handle that output as sensitive, at the terminal, not piped anywhere).

- [ ] 7.1 If Redis has no `requirepass` set (default per `ENVIRONMENT.md`'s bare `redis://localhost:6379` install instructions): there's no password to rotate, but confirm Redis is bound to `localhost`/a private interface only, not exposed publicly (`redis-cli -h <public-ip> ping` from outside the VPS should fail/timeout). If it's reachable publicly, that's the real fix here — set `bind 127.0.0.1` in `redis.conf` and restart the `redis-server` service (separately from the PM2 reload in §9).
- [ ] 7.2 If Redis does have `requirepass` set: generate a new one (`openssl rand -base64 24`), set it in `redis.conf`, restart `redis-server` (`sudo systemctl restart redis-server`) — this is a separate service from PM2/Next.js, so restarting it doesn't count against the "one PM2 restart" budget.
- [ ] 7.3 Stage the new `REDIS_URL` (with new password if applicable) for the single `.env` edit in §9.

**What breaks during the swap:** if `requirepass` changes and `redis-server` restarts before `.env`/PM2 catch up, `src/lib/redis.ts`'s client will hit connection errors — but this fails safe: `checkRateLimit` in `src/lib/auth/rate-limit.ts` degrades to its in-memory fallback (or fails closed for `failMode: "closed"` routes) rather than crashing requests. Expect a `[Redis] connection error` log line during the gap, not an outage.

**Verify after §9 reload:**
- [ ] 7.4 `pm2 logs motoxplus` shows no repeated `[Redis] connection error` / `[RateLimit] Redis error` after the reload.
- [ ] 7.5 From the VPS: `redis-cli -a '<NEW_PASSWORD>' ping` (if auth is set) returns `PONG`.

---

## §8 — Shiprocket and WhatsApp Cloud API (net-new / not applicable)

**`SHIPROCKET_EMAIL` / `SHIPROCKET_PASSWORD`:** not found anywhere in `.env` git history — there is currently no Shiprocket integration in this codebase at all (confirmed by repo search; being built separately). These aren't a rotation-due-to-leak item. Documenting for when they're first provisioned:

- **Issued/changed:** Shiprocket dashboard (`app.shiprocket.in`) → this is the actual account login (email + password), not an API-key concept — there is no separate "regenerate token" action; changing the password is the only rotation mechanism, and it's a single, non-dual-key credential.
- **What breaks during the swap:** rotating the account password **immediately invalidates every currently-live Shiprocket bearer token**, including whatever the app has cached (tokens are long-lived, ~10 days per Shiprocket's docs at the time of writing — reconfirm against current Shiprocket documentation, as they've changed this before). Any in-flight order push, label generation, or tracking call fails with 401 until the app re-authenticates. If the Shiprocket auth layer (single-flight token acquisition + Redis caching + 401-retry, built alongside this runbook) is deployed, the very next request after rotation should self-heal via its one-retry-then-relogin path — but to avoid depending on that path for a rotation you're doing deliberately, **manually delete the cached token key from Redis right after changing the password** (`redis-cli DEL shiprocket:auth:token` — see `src/lib/shiprocket/auth.ts`) so the first post-rotation request re-authenticates cleanly instead of racing a 401.
- **Downtime window:** budget a few seconds to low-single-digit minutes depending on in-flight request volume at rotation time — do this during low order volume, and immediately after, confirm a tracking/order call succeeds before considering it done.
- **Verify:** trigger any Shiprocket-backed call (once integrated) and confirm 200, not 401.

**WhatsApp Cloud API token:** no such variable exists in `.env.example`, in any historical `.env` commit, or anywhere in the current codebase (verified by repo-wide search). If WhatsApp Cloud API is configured somewhere outside this repo (e.g. directly in Meta Business Manager with no corresponding app code), it's out of scope for this runbook — nothing here reads or sends through it. No rotation action needed on the application side.

---

## §9 — Synchronized cutover (single PM2 restart)

Do this only once every value above is staged and ready — this is the one moment all of it goes live together.

- [ ] 9.1 SSH into the VPS, `cd` to the app directory.
- [ ] 9.2 Edit `.env` directly (`nano .env` or `vim .env`) and replace **every** rotated value from §1–§8 in one editing session: `DATABASE_URL`, `JWT_SECRET`, `NEXTAUTH_SECRET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `NEXT_PUBLIC_RAZORPAY_KEY_ID`, `RESEND_API_KEY`, `DELHIVERY_API_TOKEN`, `DELHIVERY_WEBHOOK_SECRET`, `MSG91_AUTH_KEY`, `TWILIO_AUTH_TOKEN`, `FAST2SMS_API_KEY`, `REDIS_URL` (+ `SHIPROCKET_EMAIL`/`SHIPROCKET_PASSWORD` if that integration is live at rotation time).
- [ ] 9.3 Double-check every variable name matches `.env.example` exactly (typos here are a silent-fallback risk — `src/lib/env.ts`'s boot check catches missing/placeholder values but not a misspelled key that just never gets read).
- [ ] 9.4 If the Shiprocket integration is live: flush its cached token from Redis now (see §8).
- [ ] 9.5 Restart PM2 — **exactly once**, using the zero-downtime reload documented in `ecosystem.config.js`:
  ```
  pm2 reload ecosystem.config.js --env production
  ```
  This respects the app's `wait_ready`/`kill_timeout` graceful-shutdown settings and cycles cluster workers one at a time rather than dropping all of them simultaneously. Plain `pm2 restart` also works but has a brief all-at-once gap — prefer `reload`.
- [ ] 9.6 `pm2 status` — confirm all instances show `online` with a recent uptime, not crash-looping.

---

## §10 — Post-rotation verification and cleanup

- [ ] 10.1 Run through the "Verify after §9 reload" checks in §1–§7 above.
- [ ] 10.2 `pm2 logs motoxplus --lines 200` — scan for any auth/connection errors from any provider.
- [ ] 10.3 Once everything in 10.1–10.2 is clean, **revoke every old credential** at its source: old R2 token, old Razorpay key pair, old Resend key, old Delhivery token, old MSG91/Twilio/Fast2SMS keys. (DB password and Shiprocket password have no "old version" to separately revoke — they stopped working the moment you changed them in §1/§8.)
- [ ] 10.4 Delete `.env.pre-rotation-backup` from the VPS (§0.3) once you're confident you won't need to roll back.
- [ ] 10.5 (Optional, lower priority) Scrub `.env` from git history with `git filter-repo` or BFG Repo-Cleaner, then force-push and have any other clone re-clone fresh. This is hygiene for anyone who might access the repo in the future — it does **not** need to happen before or during rotation, since rotation already renders the historical values worthless.
