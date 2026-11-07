# Vendor registration & onboarding API (Java)

**Status:** implemented in `backend-java` (packages `com.motoxplus.api.vendor.*`), behind `MARKETPLACE_ENABLED=true`, tables from
Flyway `V3__vendor_onboarding.sql`. Replaces the earlier single multipart `POST /api/v1/vendors/register` contract, which was never built.
Decisions: one vendor concept on `public."Vendor"` + role `VENDOR` (V1); manual approval (V2); Java only (V3).

All responses use the standard envelope: errors are `{ error, code?, fieldErrors?, retryAfterSeconds? }`.
Field-level problems are `400 VALIDATION_FAILED` (or `409 CONFLICT`) with `fieldErrors: { field: message }`.
Auth is the `mx_access` cookie (set by `/api/auth/login`) or a Bearer JWT. The vendor is always taken from the token.

## Registration (public)
`POST /api/v1/vendors/register` `{ fullName, mobile, email, password }`
→ `201 { userId, vendorId, email, status: "PENDING_VERIFICATION", emailVerificationRequired, mobileVerificationRequired }`.
Creates `User{role: VENDOR}` + `Vendor{status: PENDING}` + `marketplace.vendor_application`, sends the email OTP (shared `OtpCode`,
interoperable with Node). 409 on duplicate email/mobile. Rate limit `REGISTER` (5/min per IP, 5/h per email).
The web client then calls the existing `POST /api/auth/login` and continues on `/verify-email` and `/verify-mobile`.

## Onboarding (role VENDOR, email + mobile verified, application not submitted)
| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/api/v1/vendors/me/application` | | Application, derived `state`, `steps`, `missingDocuments`, last `decision` |
| PUT | `/api/v1/vendors/me/application/business` | `{ businessName, businessType, pan, gstin, address, state, city, pincode }` | GSTIN must match PAN and be unique |
| PUT | `/api/v1/vendors/me/application/categories` | `{ categoryIds, vehicleSegments }` | Shared `PartCategoryValidator`; stored as `VendorPartCategory` rows |
| PUT | `/api/v1/vendors/me/application/bank` | `{ accountHolder, bankName, accountNumber, ifsc }` | Number AES-GCM encrypted (`ENCRYPTION_KEY`); only last 4 returned |
| POST | `/api/v1/vendors/me/application/documents` | multipart `documentType`, `file` | PDF/JPG/PNG by content, ≤ 5 MB, private bucket only |
| DELETE | `/api/v1/vendors/me/application/documents/{documentType}` | | |
| GET | `/api/v1/vendors/me/application/documents/{documentId}/url` | | `{ url, expiresIn: 300 }`, own documents only |
| POST | `/api/v1/vendors/me/application/submit` | `{ acceptTerms, acceptVendorAgreement, declareGenuineProducts, declareAccurateInformation }` | All must be true; incomplete steps come back as `fieldErrors` keyed by check code |

Edits return `403 VERIFICATION_REQUIRED` before email/mobile verification and `409 APPLICATION_LOCKED` while under review or after approval.

Document types: `PAN_CARD` (required), `GST_CERTIFICATE` (required when a GSTIN is given), `CANCELLED_CHEQUE` (required),
`BUSINESS_REGISTRATION`, `ADDRESS_PROOF` (optional). Aadhaar is never collected.

## State (derived, never stored)
`Vendor.status` APPROVED→`ACTIVE`, REJECTED→`REJECTED`, SUSPENDED→`SUSPENDED`, BLACKLISTED→`BLOCKED`. For PENDING: unverified contact →
`PENDING_VERIFICATION`; submitted → `UNDER_REVIEW`; details done but required documents missing → `DOCUMENTS_PENDING`; otherwise `DRAFT`.

## Admin review
View: `marketplace.vendor.view` (ADMIN, SUPER_ADMIN, SUPPORT). Decide / reveal bank number: `marketplace.vendor.approve` (ADMIN, SUPER_ADMIN).

| Method | Path | Notes |
|---|---|---|
| GET | `/api/v1/admin/vendor-applications?state=&q=&page=&size=` | Self-registered vendors only |
| GET | `/api/v1/admin/vendor-applications/{vendorId}` | + `checks` (from submission), `history` (audit log), `agreements`, `categoryNames` |
| GET | `/api/v1/admin/vendor-applications/{vendorId}/documents/{documentId}/url` | 5-minute link; audited |
| GET | `/api/v1/admin/vendor-applications/{vendorId}/bank-account` | Full number; audited |
| POST | `/api/v1/admin/vendor-applications/{vendorId}/{approve\|reject\|request-changes\|suspend\|reactivate\|block}` | `{ reason }` required (≥ 5 chars) except approve/reactivate |

Transitions: approve / request-changes need `UNDER_REVIEW`; reject needs a pending application; suspend needs `ACTIVE`; reactivate needs
`SUSPENDED`; block works from any state. Each transition is guarded on the current status, so concurrent reviewers can't both act (409).
