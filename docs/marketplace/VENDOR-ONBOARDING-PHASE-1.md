# Vendor onboarding — Phase 1 (platform fixes + shared services in Java)

**Status:** implemented and tested locally. Nothing committed, nothing deployed, no real database or bucket touched.
**Plan:** `VENDOR-ONBOARDING-PHASE-0.md` (decisions V1–V3).

## 1a. Platform fixes (Next.js, existing routes only)

| Change | Files |
|---|---|
| KYC documents go to a **private R2 bucket** (`R2_PRIVATE_BUCKET_NAME`); the row stores `r2-private://<key>`, never a URL. Until the bucket is set, uploads fall back to the old public behaviour with a logged warning. | `src/lib/storage/private.ts` (new), `r2.ts`, `signed.ts`, `delete.ts`, `index.ts`, `api/upload/dealer-document/route.ts` |
| Replacing a dealer document now deletes the previous file (it used to stay in storage). | `api/upload/dealer-document/route.ts` |
| Signed viewing links routed to the correct bucket; lifetime cut from 15 to 5 minutes. | `api/files/signed/[id]/route.ts`, `api/upload/[id]/route.ts` |
| One-off mover for existing documents: dry run by default, `--yes` copies + verifies size + updates the row, `--delete-public` removes public copies only after the private copy is confirmed. | `scripts/storage/move-documents-private.ts` |
| `getVerifiedVendor` now also requires `user.isActive`, email and mobile verification. It had **no callers**; it now guards vendor product submission and purchase-order accept/reject (a suspended or rejected vendor could previously accept/reject POs). | `src/lib/auth/verified-account.ts`, `api/vendor/products`, `api/vendor/purchase-orders/[id]/{accept,reject}` |

Tests: `src/lib/storage/private.test.ts` (4), `src/lib/auth/verified-account.test.ts` (8). Full Node suite: **600/600**.

## 1b. Shared services in Java (no endpoints yet; used by Phase 2)

| Module | Port of | Notes |
|---|---|---|
| `notify.email.EmailService` | `lib/email/index.ts` | Resend REST via JDK `HttpClient`; skip-when-unconfigured like Node; optional `Idempotency-Key`. Recipient not logged. |
| `notify.otp.WhatsAppOtpSender` | `lib/sms/providers/whatsapp.ts` | Same Copy Code template payload, same Meta error mapping, OTP/token redacted from logs. |
| `notify.otp.Msg91OtpSender` | `lib/sms/providers/msg91.ts` | Auth key sent as `authkey` **header**, not in the URL (Node puts it in the query string). |
| `notify.otp.OtpSenders` | `lib/sms/index.ts` | `SMS_PROVIDER` = `whatsapp` or `msg91`. **Deliberate difference:** an unconfigured provider fails the send instead of reporting success; `SMS_LOG_UNSENT_OTP=true` prints codes for local dev only. |
| `auth.otp.OtpService` | `lib/auth/otp.ts` | Same table, same HMAC (`otp:{userId}:{type}:{code}` keyed with `JWT_SECRET`), limits and race-safe claim. **Codes issued by Node verify in Java and vice versa** (tested with a Node-generated hash). |
| `storage.StorageService` | `lib/storage/*` | R2 via AWS SDK v2 S3 (`2.29.0`, JDK URL-connection client; Netty/Apache excluded). Public and private buckets; signed URLs capped at 300 s; **private uploads fail closed** if the private bucket is not configured (no public fallback in Java). |

Config: same env names as Node (`RESEND_API_KEY`, `EMAIL_FROM`, `SMS_PROVIDER`, `WHATSAPP_*`, `MSG91_*`, `R2_*`, new
`R2_PRIVATE_BUCKET_NAME`, dev-only `SMS_LOG_UNSENT_OTP`), mapped in `application.properties`.

Tests: `OtpServiceIntegrationTest` (9, real embedded PostgreSQL), `NotifyProvidersTest` (6), `StorageServiceTest` (4), all against a local fake
HTTP server; no real provider is called. Full Java suite: **133/133**.

## Environment notes
- `pom.xml` targets **Java 21** (commit `ec7d448`), but only JDK 17 is installed on this PC. Tests were run with `-Djava.version=17`;
  the new code uses nothing newer than 17. Install JDK 21 to build the real target.
- Not verified against live services: Resend, WhatsApp Cloud API, MSG91 (`authkey` header form) and R2 were exercised only through fakes.

## Before deploying
1. Create the private R2 bucket (public access off), grant the existing R2 token read/write, set `R2_PRIVATE_BUCKET_NAME` for both apps.
2. Upload a test dealer document and open it from the admin panel.
3. Run `scripts/storage/move-documents-private.ts` (dry run → `--yes` → check a few documents → `--delete-public`).

## Carried into Phase 2
- Per decision V1, grant the marketplace permissions to `VENDOR` (Phase 1 marketplace seeds use `SELLER`/`SELLER_STAFF`).
- Email OTP templates (verify-email HTML) to port alongside the registration endpoint.
