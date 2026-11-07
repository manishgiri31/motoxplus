# Vendor onboarding — Phase 2 (registration, onboarding, manual approval)

**Status:** implemented and tested locally. Nothing committed or deployed; no real database, bucket or email touched.
API contract: `SELLER-REGISTRATION-API.md`. Plan and decisions: `VENDOR-ONBOARDING-PHASE-0.md`.

## The journey
1. `/become-vendor` → **Start selling** → `/become-vendor/register` (account: name, mobile, email, password).
2. Java creates the vendor login; the page signs in through the existing `/api/auth/login`.
3. Existing `/verify-email` then `/verify-mobile` (OTP codes are interchangeable between Node and Java).
4. Middleware sends every unapproved vendor to `/vendor/onboarding`; one page per step:
   `/business` → `/categories` → `/bank` → `/documents` → `/review` (four declarations, submit).
5. Reviewer works from **Admin → Vendor applications**: automated checks, documents, bank, history; approve, request changes,
   reject; later suspend / reactivate / block.
6. On approval the vendor is emailed; the onboarding page refreshes the session and opens `/vendor/dashboard`.

## Backend (`backend-java`)
- Flyway **V3** (additive): `marketplace.vendor_application`, `vendor_bank_account` (encrypted number), `vendor_agreement_acceptance`
  (append-only); `ADDRESS_PROOF` added to `public."VendorDocumentType"`; marketplace permissions moved from the unused `SELLER` role to
  `VENDOR` (decision V1).
- Modules, one per feature: `vendor.registration`, `vendor.onboarding.{overview,business,categories,bank,documents,submit}`, `vendor.review`;
  shared `vendor.{VendorRepository, VendorContext, ApplicationState, ApplicationView}`.
- Shared helpers: `common.FieldCrypto` (AES-GCM, byte-compatible with `src/lib/crypto/encryption.ts`), `auth.PasswordPolicy`
  (same rules/messages as Node), `notify.email.EmailTemplates` (HTML-escaped), `web.FieldErrorsException`.
- Automated checks at submission (inform the reviewer, never approve): completeness, GSTIN↔PAN, PAN reused by another vendor, possible
  duplicate bank account, match with a blocked/rejected vendor, account-holder name vs business/owner, overlap with a dealer.
- Every write and every sensitive read (document view, bank reveal, decisions) goes to `marketplace.audit_log`, which is the vendor's
  verification history.
- Tests: `VendorOnboardingIntegrationTest` (8 scenarios, real PostgreSQL + Flyway V1–V3, fake R2). Full suite **143/143 on JDK 21**.

## Frontend (Next.js, UI only)
- `/become-vendor/register` (`components/vendor/onboarding/vendor-register-form.tsx`); redirects to the interest form while
  `NEXT_PUBLIC_SELLER_SIGNUP_OPEN` is unset.
- `/vendor` split into route groups: `(portal)/` keeps the sidebar for approved vendors, `onboarding/` has a focused layout.
- Onboarding modules: `application-context`, `onboarding-frame`, `step-page`, `application-status`, `business-step`, `categories-step`,
  `bank-step`, `documents-step`, `review-step`; API client `src/lib/vendor/onboarding.ts`.
- Admin: `/admin/vendors/applications` (queue) and `/admin/vendors/applications/[vendorId]` (review); client `src/lib/vendor/review.ts`.
- Removed: the old single-page wizard (`registration-wizard.tsx`, `wizard-steps.tsx`, `wizard-controls.tsx`) and its draft/submit code;
  `src/lib/seller/registration.ts` now only holds the shared business rules.
- `/api/v1/*` → Java: `next.config.mjs` rewrite (`JAVA_API_URL`) for dev, `nginx.conf` `location /api/v1/` for production.
- Node tests **584/584**.

## To go live
1. Private R2 bucket + `R2_PRIVATE_BUCKET_NAME` (Phase 1), and the **same** `ENCRYPTION_KEY` in both apps.
2. Database takeover per `DB-TAKEOVER.md` (applies Flyway V2 + V3), then run Java with `MARKETPLACE_ENABLED=true`.
3. Reload Nginx with the new `/api/v1/` block.
4. Publish the vendor agreement; set `NEXT_PUBLIC_SELLER_AGREEMENT_URL` and `NEXT_PUBLIC_SELLER_AGREEMENT_VERSION` (both apps).
5. Only then set `NEXT_PUBLIC_SELLER_SIGNUP_OPEN=true` and rebuild Next.

## Known limits
- No PAN / GSTIN / bank (penny-drop) verification provider: the reviewer compares the documents by eye (decision V2).
- Not rendered in a browser yet: the pages typecheck, lint and are covered by API tests, but need a visual pass with Java running.
- `/become-supplier` (old Node supplier form) still works and creates a PENDING vendor without the new application data;
  retire it once self-registration is live.
- Vendor emails (submitted/approved/rejected) are sent by Java via Resend; not tested against the live Resend account.
