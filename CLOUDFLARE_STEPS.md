# Cloudflare WAF checklist for motoxplus.com

You apply these in the Cloudflare dashboard yourself. Nothing here is automated, and I could not see your account, so:

* **Plan limits change.** Free plans have a small cap on custom rules and rate-limiting rules (at the time of writing: 5 custom
  rules, 1 rate-limiting rule). Items marked **(paid)** need Pro or higher. Check *Security -> WAF* for what your plan allows,
  and add rules in the priority order below until you run out.
* **Roll out in this order for every rule: `Log` -> `Managed Challenge` -> `Block`.** Watch *Security -> Events* for a day or two
  at each step. A rule that blocks your own dealers or the mobile app is worse than no rule.
* Rule expressions use Cloudflare's rules language. Paste them with *Edit expression*.

What already protects the origin (so these rules are an extra outer layer, not the only defence): Nginx `limit_req` zones,
the app's Redis-backed limiters (login 5 failures/15 min per account, OTP caps, 120/min on public reads), the database account
lockout, and webhook signature checks. Cloudflare's job is to absorb floods and scanners **before** they reach the VPS, so keep its
thresholds **looser** than the app's. Dealers behind one office router share a single public IP.

---

## 0. Prerequisites (verify first)

- [ ] DNS records for `motoxplus.com` and `www` show the **orange cloud (Proxied)**. A grey cloud bypasses every rule below.
- [ ] *SSL/TLS -> Overview*: mode **Full (strict)** (the origin has a Let's Encrypt cert; "Flexible" would loop and expose traffic).
- [ ] *SSL/TLS -> Edge Certificates*: **Always Use HTTPS** on, **Minimum TLS Version 1.2**, **Automatic HTTPS Rewrites** on.
      Turn **HSTS** on only after confirming HTTPS works everywhere (it is hard to undo).
- [ ] **Origin is locked to Cloudflare.** Without this a scanner that finds the VPS IP skips Cloudflare entirely. Follow
      `VPS-HARDENING.md` section 2 (`ufw allow from <Cloudflare ranges> to any port 80,443`) and keep
      `scripts/vps/refresh-cloudflare-ips.sh` on cron. Verify from your laptop: `curl -m 8 -k https://<ORIGIN_IP>/` must **time out**.
- [ ] `nginx.conf` trusts `CF-Connecting-IP` (`cloudflare-ips.conf` is installed) so Nginx limits see the visitor, not Cloudflare.

## 1. Settings to turn OFF (they break or break-in the Next.js app)

- [ ] *Speed -> Optimization*: **Rocket Loader OFF.** It re-orders scripts and can cause React hydration errors.
- [ ] **Auto Minify (HTML/JS/CSS) OFF** (Next.js already minifies; HTML minify has caused hydration mismatches).
- [ ] **Email Address Obfuscation OFF** and **Mirage OFF** (they rewrite HTML/images the app also renders).
- [ ] *Caching -> Configuration*: **do not cache `/api/*`, `/admin/*`, `/dealer/*`, `/account/*`, `/vendor/*`**. If you add a cache
      rule, make it match only `/_next/static/*` and `/images/*`. The pages are personalised.

## 2. Managed rules (enable)

- [ ] *Security -> WAF -> Managed rules*: enable the **Cloudflare Managed Ruleset** (the free managed rules are on by default; check).
- [ ] **(paid)** Enable the **Cloudflare OWASP Core Ruleset**. Start at paranoia level 1 / score threshold "Medium - 40 and higher",
      action **Log** for a few days, then **Block**. Expect false positives on admin forms that submit HTML/long text
      (product descriptions, CRM notes); add a skip exception for `/api/admin/*` only if events show it.
- [ ] **(paid)** Enable **Exposed credentials check** (leaked-credentials detection) and set action to Log, then Managed Challenge on
      `/api/auth/login`.
- [ ] *Security -> Settings*: **Security Level = Medium**, **Browser Integrity Check = On**
      (**test the Flutter mobile app after this**: native HTTP clients sometimes trip it; if so, see "Mobile app" below).
- [ ] *Security -> Bots*: **Bot Fight Mode = On** (free). **(paid)** Prefer *Super Bot Fight Mode*: "Definitely automated -> Block",
      "Likely automated -> Managed Challenge", "Verified bots -> Allow".
      Bot Fight Mode can't be bypassed by custom rules, so test webhooks (section 3, rule 1) and the mobile app immediately after enabling.

## 3. Custom rules (WAF -> Custom rules), in this order

Rules run top to bottom; a *Skip* rule must be first.

1. **Let payment and courier webhooks through** - action: *Skip* (all remaining custom rules, and rate limiting if allowed)
   ```
   (http.request.method eq "POST" and http.request.uri.path in {"/api/webhooks/razorpay" "/api/webhooks/delhivery"})
   ```
   These are authenticated by HMAC signature / secret token in the app, and throttling or challenging them risks losing payment
   events. After any change here, make a Razorpay test-mode payment and confirm the webhook still arrives (Razorpay dashboard ->
   Webhooks -> delivery log shows 200).
2. **Block scanner paths** - action: *Block* (this site has none of these files, so any hit is a probe)
   ```
   (http.request.uri.path contains "/.env") or (http.request.uri.path contains "/.git") or
   (http.request.uri.path contains "/wp-admin") or (http.request.uri.path contains "/wp-login") or
   (http.request.uri.path contains "/xmlrpc.php") or (http.request.uri.path contains "/phpmyadmin") or
   (http.request.uri.path contains "/vendor/phpunit") or (http.request.uri.path contains "/.aws") or
   (http.request.uri.path contains "/server-status") or (http.request.uri.path contains "/actuator") or
   (http.request.uri.path contains "/.ssh") or (http.request.uri.path contains "/id_rsa")
   ```
3. **Challenge login/OTP/registration abuse from non-India** - action: *Managed Challenge* **(only if your users are all in India;
   skip this rule if dealers, vendors or staff ever sign in from abroad)**
   ```
   (ip.src.country ne "IN" and http.request.method eq "POST" and
    http.request.uri.path in {"/api/auth/login" "/api/auth/login-otp" "/api/auth/send-mobile-otp"
    "/api/auth/forgot-password" "/api/auth/register" "/api/auth/customer/register"})
   ```
4. **Block requests with no User-Agent on the API** - action: *Block*
   ```
   (http.request.uri.path starts_with "/api/" and http.user_agent eq "")
   ```
   The mobile app sends a Dart user agent, browsers always send one. (Do not use *Managed Challenge* here: API clients cannot solve it.)
5. **Challenge the admin area from outside India** - action: *Managed Challenge* (optional, same caveat as rule 3)
   ```
   (ip.src.country ne "IN" and (http.request.uri.path starts_with "/admin" or http.request.uri.path starts_with "/api/admin"))
   ```

Do **not** challenge `/api/mobile/*`, `/api/auth/refresh` or `/api/webhooks/*`: they are called by the app or other servers,
and a challenge page is unanswerable for them.

## 4. Rate limiting rules (WAF -> Rate limiting rules)

Cloudflare counts per client IP by default. Free plan: **1 rule** (so take #1); more on paid plans. Keep the limits above anything a
real user does. If you set a rule's action to *Block*, choose a block duration of 10 minutes to 1 hour.

1. **Auth endpoints** (most important)
   ```
   (http.request.method eq "POST" and http.request.uri.path in {
     "/api/auth/login" "/api/auth/login-otp" "/api/auth/send-mobile-otp" "/api/auth/send-email-verification"
     "/api/auth/forgot-password" "/api/auth/verify-forgot-password-otp" "/api/auth/reset-password"
     "/api/auth/verify-mobile" "/api/auth/verify-email" "/api/auth/register" "/api/auth/customer/register"
     "/api/dealer/register" "/api/vendor/register" "/api/mobile/auth/login" "/api/mobile/auth/login-otp"})
   ```
   Suggested: **30 requests per 1 minute per IP** (or the longest period your plan allows) -> Block 10 minutes.
   This is looser than the app (login: 20 failures per 15 min per IP; OTP: 8 sends per minute per IP) on purpose.
2. **(paid) Public read endpoints** that hit the DB or Delhivery: `/api/products/search`, `/api/categories`,
   `/api/shipping/serviceability` -> **240 per minute per IP** (the app already enforces 120/min; this only catches floods).
3. **(paid) Whole API**: `starts_with(http.request.uri.path, "/api/")` and *not* a webhook/health path -> **600 per minute per IP**.
4. **(paid) Contact form**: `/api/contact` POST -> 10 per minute per IP.

Never rate limit `/api/health*` (Nginx, deploys and the monitor use it) or `/api/webhooks/*`.

## 5. Mobile app (Flutter) - test before and after

After turning on Bot Fight Mode, Browser Integrity Check, Security Level or any challenge:
- [ ] Open the app on a phone: log in with password, log in with OTP, load the product list, refresh a token (wait 15+ minutes or
      force it), place a test order.
- [ ] If anything returns an HTML "Just a moment..." page or 403, the cause is a bot/challenge setting. Fix by turning that
      setting off, or (paid) adding a *Skip* rule for `starts_with(http.request.uri.path, "/api/mobile/")`.

## 6. Verification (do these after applying; takes 10 minutes)

```bash
# probes are blocked (rule 2)               -> 403
curl -s -o /dev/null -w "%{http_code}\n" https://motoxplus.com/.env
curl -s -o /dev/null -w "%{http_code}\n" https://motoxplus.com/wp-login.php

# empty user agent on the API is blocked    -> 403 (rule 4)
curl -s -A "" -o /dev/null -w "%{http_code}\n" https://motoxplus.com/api/categories

# normal traffic is fine                     -> 200
curl -s -o /dev/null -w "%{http_code}\n" https://motoxplus.com/api/categories

# auth flood gets cut off by Cloudflare      -> 429 after the threshold (use a throwaway email!)
for i in $(seq 1 40); do curl -s -o /dev/null -w "%{http_code} " -X POST https://motoxplus.com/api/auth/login \
  -H 'content-type: application/json' -d '{"email":"nobody@example.com","password":"x"}'; done; echo

# origin cannot be reached directly          -> connection timeout
curl -m 8 -k https://<ORIGIN_IP>/
```

- [ ] *Security -> Events*: filter by the last hour; every blocked/challenged request should be a probe or your own test. If you see
      real dealer IPs or the Razorpay/Delhivery servers, set that rule back to *Log* and loosen it.
- [ ] Razorpay test payment completes and its webhook shows `200` in the Razorpay dashboard.
- [ ] A dealer can log in from a normal browser, and the mobile app works (section 5).

## 7. During an attack

1. *Security -> Events* to see what is hitting you (path, country, user agent, ASN).
2. Add a rule that matches that pattern, action **Managed Challenge** (browsers) or **Block** (APIs/bots).
3. Last resort: *Security -> Settings -> Security Level = Under Attack* (interstitial for every visitor; **breaks the mobile app and
   webhooks** until you switch it back, so tell dealers and re-enable webhooks' skip rule first).
4. To pause Cloudflare entirely (e.g. a rule is wrongly blocking everyone): *Overview -> Advanced actions -> Pause Cloudflare on Site*
   or disable the rule. Remember the origin only accepts Cloudflare's IPs, so un-proxying DNS also requires opening the firewall.

## 8. What Cloudflare cannot fix (still on the app side)

* **Client IP spoofing in the app's own limiter.** `getClientIP()` (`src/lib/auth/middleware.ts`) takes the *first*
  `X-Forwarded-For` value, which a client can set. Nginx writes the true address into `X-Real-IP`; preferring that header (or the
  last `X-Forwarded-For` hop) closes it. Cloudflare's own limits are unaffected, but the app-level per-IP limits can be bypassed
  until this is fixed. Not changed here because it alters behaviour of every existing limiter.
* `GET /api/health` is public and includes the raw database error text when the DB is down. Consider trimming it.
