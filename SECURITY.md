# MotoXPlus — Security Guide

## Security Architecture

### Authentication
- **NextAuth.js** with JWT strategy (8-hour sessions in production)
- **bcrypt** password hashing (cost factor 10)
- **Account lockout** after 5 failed login attempts (30-minute lockout)
- **Cookie hardening**: `HttpOnly`, `Secure`, `SameSite=Lax`
- **OTP verification** for mobile and email with:
  - 6-digit codes, 10-minute expiry
  - Max 3 incorrect attempts per OTP
  - Max 5 resends per hour

### Authorization
- **Role-based access control** enforced in middleware and every API route
- Roles: `SUPER_ADMIN`, `ADMIN`, `STAFF`, `DEALER`, `VENDOR`, `GUEST`
- Staff access is further scoped by `department` (`SALES`, `MARKETING`, `PRODUCTION`, `ACCOUNTS`)
- Middleware checks run on every protected route before any page or API handler executes

### HTTP Security Headers
Applied to all responses:

| Header | Value |
|--------|-------|
| `X-Frame-Options` | `SAMEORIGIN` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | Blocks camera, microphone, geolocation |
| `Strict-Transport-Security` | 2-year max-age, includeSubDomains, preload |
| `Content-Security-Policy` | Restricts scripts/frames to self + Razorpay |

### Rate Limiting (Nginx)

| Zone | Limit | Applies to |
|------|-------|-----------|
| `auth` | 10 req/min | `/api/auth/*` |
| `api` | 30 req/min | `/api/*` |
| `upload` | 5 req/min | `/api/upload/*` |
| `global` | 60 req/min | All routes |

### Rate Limiting (Application)
In-memory IP-based rate limiting on login endpoint (falls back from Redis).  
Deploy Redis for multi-instance deployments.

### CSRF Protection
Handled by NextAuth.js CSRF token mechanism (double-submit cookie pattern).

### SQL Injection
Prisma ORM uses parameterized queries exclusively. No raw SQL is used except for health checks (`SELECT 1`).

### XSS
- React escapes all user content by default
- CSP restricts script sources
- `dangerouslySetInnerHTML` is not used

### File Upload Security
- MIME type validation (allowlist: JPEG, PNG, WebP, PDF)
- File size limits (5 MB images, 10 MB documents)
- Files stored in Cloudflare R2 (not served from app server)
- Unique UUIDs for all uploaded filenames (no user-controlled paths)
- Images converted to WebP via Sharp (strips EXIF data)

### Secrets Management
- All secrets loaded from environment variables — never hardcoded
- `.env` file is git-ignored
- Startup validation crashes the app if required secrets are missing

---

## Security Checklist

### Before every deployment
- [ ] `.env` is not in git (`git status` shows no `.env`)
- [ ] `RAZORPAY_KEY_ID` is a live key (not `rzp_test_*`)
- [ ] `NEXTAUTH_SECRET` is at least 32 chars
- [ ] `JWT_SECRET` is at least 32 chars
- [ ] Database is local (not Railway/remote)

### Monthly
- [ ] Review PM2 logs for repeated 4xx/5xx errors
- [ ] Check `fail2ban` status: `sudo fail2ban-client status`
- [ ] Verify Let's Encrypt renewal: `sudo certbot renew --dry-run`
- [ ] Test database backup restore on staging

### Quarterly
- [ ] Rotate `NEXTAUTH_SECRET` (invalidates all sessions)
- [ ] Rotate `JWT_SECRET` (invalidates all refresh tokens)
- [ ] Rotate R2 API credentials
- [ ] Review active admin accounts: `/admin/admins`
- [ ] Review approved vendor accounts
- [ ] Update Node.js to latest LTS patch

---

## Incident Response

### Suspected credential leak

1. Immediately rotate the leaked credential
2. Update `.env` on the server
3. Reload PM2: `pm2 reload motoxplus`
4. Review access logs: `tail -1000 /var/log/nginx/motoxplus-access.log | grep "4[0-9][0-9]\|5[0-9][0-9]"`
5. If NextAuth secret was leaked: all sessions are invalidated automatically after rotation

### Suspected database compromise

1. Change database password immediately
2. Update `DATABASE_URL` in `.env`
3. Reload PM2
4. Restore from last known-good backup if data was modified
5. Enable PostgreSQL query logging temporarily to audit activity

### Account compromise

1. Disable the user: Admin → Users → Disable Account
2. Force logout: `DELETE FROM "Session" WHERE "userId" = 'USER_ID';`
3. Review order and payment history for that account

---

## Security Contacts

For security vulnerabilities, contact: **info@motoxplus.in**

Please use responsible disclosure. Do not publish vulnerabilities before they are fixed.
