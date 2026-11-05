# MotoXPlus — Environment Variables Reference

All environment variables are documented in [.env.example](.env.example).  
This document explains the purpose and security requirements of each group.

## Required vs Optional

| Marker | Meaning |
|--------|---------|
| **[REQUIRED]** | App crashes at startup if missing |
| **[OPTIONAL]** | Feature degrades gracefully if missing |

---

## DATABASE

### `DATABASE_URL`
**[REQUIRED]** PostgreSQL connection string.

**Production:** Use a local socket connection for best performance:
```
postgresql://motoxplus:PASSWORD@localhost/motoxplus
```

**Security notes:**
- Use a dedicated database user with only the permissions it needs
- Never use the `postgres` superuser in production
- Rotate the password quarterly
- The .env file must never be committed to Git

---

## NEXTAUTH

### `NEXTAUTH_URL`
**[REQUIRED]** The canonical URL of the application. Used for OAuth callbacks and CSRF.

```
NEXTAUTH_URL=https://motoxplus.com
```

### `NEXTAUTH_SECRET`
**[REQUIRED]** Secret used to sign/encrypt JWT tokens and CSRF tokens.

Generate: `openssl rand -hex 32`

**Security notes:**
- Must be at least 32 characters
- Changing this invalidates all active sessions
- Rotate if you suspect compromise

---

## RAZORPAY

### `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET`
**[REQUIRED]** Razorpay API credentials.

- Use `rzp_test_*` in development
- Use `rzp_live_*` in production
- **Never** expose `RAZORPAY_KEY_SECRET` to the browser
- Enable only the IP allowlist in Razorpay dashboard for the server IP

### `NEXT_PUBLIC_RAZORPAY_KEY_ID`
**[REQUIRED]** Browser-safe Razorpay key (only the `key_id`, never the secret).

---

## CLOUDFLARE R2

### `R2_ACCOUNT_ID`
Your Cloudflare account ID (found in Cloudflare dashboard URL or Account Home).

### `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`
**[REQUIRED]** R2 API token credentials.

Create at: Cloudflare → R2 → Manage R2 API tokens  
Scope the token to **only** the `motoxplus-assets` bucket with Object Read & Write.

### `R2_BUCKET_NAME`
**[REQUIRED]** The name of your R2 bucket.

### `R2_PUBLIC_URL`
**[REQUIRED]** The public CDN URL for the R2 bucket (enable "Public Access" in R2 settings).

---

## JWT

### `JWT_SECRET`
**[REQUIRED]** Secret for signing custom JWT tokens (mobile sessions, refresh tokens).

Generate: `openssl rand -hex 32`

---

## EMAIL — RESEND

### `RESEND_API_KEY`
**[REQUIRED]** Resend API key from https://resend.com/api-keys

Scope to only the sending domain `motoxplus.in`.

### `EMAIL_FROM`
**[REQUIRED]** Verified sender address. Must be verified in Resend dashboard.

---

## SMS — MSG91

### `SMS_PROVIDER`
**[OPTIONAL]** One of: `msg91` | `twilio` | `fast2sms`

### `MSG91_AUTH_KEY`
**[OPTIONAL if SMS_PROVIDER != msg91]** MSG91 authentication key.

### `MSG91_SENDER_ID`
6-character DLT-registered sender ID.

### `MSG91_OTP_TEMPLATE_ID`
DLT-registered OTP template ID from MSG91.

### `MSG91_FLOW_ID`
MSG91 flow/campaign ID for OTP delivery.

---

## REDIS

### `REDIS_URL`
**[OPTIONAL]** Redis connection URL.

If not set, rate limiting falls back to in-memory stores.  
**Warning:** In-memory stores do not work correctly in PM2 cluster mode.  
For production with multiple instances, Redis is strongly recommended.

Install: `sudo apt install redis-server`  
Default URL: `redis://localhost:6379`

#### How Redis is verified

* **At startup** (`src/instrumentation-node.ts`) the app sends a real `PING` and logs one of:
  * `Rate limiter: Redis OK (PING 3ms)` - healthy.
  * `WARNING: REDIS_URL is set but Redis is not answering (...)` - configured but down. **The app still boots.**
  * `Rate limiter: in-memory (per-worker ...)` - `REDIS_URL` is not set (intentional fallback).
  
  Older builds logged "Redis" whenever the variable merely existed, which hid a Redis that was never installed.
* **At runtime** `GET /api/health` includes `checks.redis` (`ok` / `disabled` / `error` + a short `reason`).
  A Redis error sets the body's `status` to `"degraded"` but keeps the HTTP status 200: only the **database**
  turns it into a 503, because deploy, rollback and the 15-minute monitor treat non-2xx as "site is broken", and
  a Redis outage must not take the site down. To alert on it anyway, have the monitor also check the body, e.g.
  `curl -sf http://localhost:3000/api/health | grep -q '"redis":{"status":"error"' && exit 1`.
  `/api/health/ready` (the deploy gate) intentionally stays database-only.

#### What happens when Redis is down: fail open

Every rate-limit budget in `src/lib/auth/rate-limit-budgets.ts` is `failMode: "open"`: if Redis is unreachable
the request is **allowed** and counted in a per-process in-memory counter instead of being rejected.

Why open, not closed: Redis only holds the *coarse* abuse gate. The controls that actually stop brute force do
not need Redis: the database-backed account lockout (5 wrong passwords -> 30 minute lock) and the per-account OTP
attempt/resend caps (`src/lib/auth/otp.ts`). Failing closed would turn a routine Redis restart into a site-wide
login/OTP/search outage (this happened on a host where Redis was never installed). Failing open only makes the
abuse gate temporarily weaker.

What the fallback costs you: the in-memory counters are **per PM2 worker**, so with N workers the effective limit
is roughly N x the configured number (e.g. 120/min becomes ~480/min on 4 cores) and counters reset on restart.
It also means the public-route limiters added in `PUBLIC_API` / `SEARCH_PUBLIC` degrade the same way.

Not rate limited by this mechanism, on purpose: `/api/health*` (monitors and the deploy gate must never get a
429) and the Razorpay/Delhivery webhooks (authenticated by signature/token; throttling them risks dropping
payment events). Nginx's `limit_req` zones still apply in front of all of them.

---

## APPLICATION

### `NEXT_PUBLIC_APP_URL`
**[REQUIRED]** Full public URL, used in:
- Email links
- OpenGraph metadata
- Sitemap
- Canonical URLs

### `NEXT_PUBLIC_COMPANY_*`
Company information displayed throughout the application (contact page, footer, emails).

---

## Generating Secrets

```bash
# NEXTAUTH_SECRET
openssl rand -hex 32

# JWT_SECRET
openssl rand -hex 32

# DELHIVERY_WEBHOOK_SECRET
openssl rand -hex 32
```

---

## Environment Files

| File | Purpose | Committed to Git |
|------|---------|-----------------|
| `.env` | Production secrets | **NO** |
| `.env.local` | Local development overrides | **NO** |
| `.env.example` | Template with placeholders | **YES** |

The `.gitignore` already excludes `.env` and `.env.local`.
