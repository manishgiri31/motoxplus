# Seller registration API contract (frontend -> Java)

**Status:** contract only. The endpoint below is **not implemented** (backend Phase 2). The `/become-vendor` wizard is built against it
and refuses to report success unless the server answers 2xx with a `userId` (see `src/lib/seller/registration.ts`, covered by tests).
Until it exists the page runs with `NEXT_PUBLIC_SELLER_SIGNUP_OPEN` unset, which shows a contact form instead of the wizard.

## `POST /api/v1/vendors/register`  (public, `multipart/form-data`)

Parts
| Part | Type | Required | Notes |
|---|---|---|---|
| `payload` | `application/json` | yes | see below |
| `panDocument` | file | yes | PDF/JPG/PNG, <= 5 MB |
| `gstCertificate` | file | when `payload.gstin` is set | PDF/JPG/PNG, <= 5 MB |
| `businessProof` | file | no | PDF/JPG/PNG, <= 5 MB |
| `bankProof` | file | yes | PDF/JPG/PNG, <= 5 MB |
| `catalogue` | file | no | PDF/CSV/XLS/XLSX, <= 10 MB |

The client enforces these limits for UX only. **The server must re-validate** content type (by sniffing, not by extension), size, count and total
(< 20 MB: Nginx and `spring.servlet.multipart` both cap at 20 MB), store files in private storage, and never serve them publicly.

### `payload`
```json
{
  "fullName": "string 2-100", "mobile": "10-digit Indian mobile, normalised", "email": "lower-case", "password": "policy: 8+ chars, upper, lower, digit, <= 72 bytes",
  "businessName": "string", "businessType": "MANUFACTURER|WHOLESALER|DISTRIBUTOR|STOCKIST|RETAILER|OTHER",
  "pan": "AAAAA9999A", "gstin": "15 chars | null  (characters 3-12 must equal pan)",
  "address": "string", "state": "string", "city": "string", "pincode": "[1-9][0-9]{5}",
  "categoryIds": ["public.\"Category\" ids"],
  "vehicleSegments": ["MOTORCYCLE|SCOOTER|THREE_WHEELER|PASSENGER_CAR|COMMERCIAL_VEHICLE|OTHER"],
  "vehicleBrands": ["Hero", "..."], "otherVehicleBrand": "string | null",
  "productBrands": ["string"], "skuRange": "UNDER_50|50_200|200_1000|1000_5000|OVER_5000", "monthlyCapacity": "string | null",
  "bank": { "accountHolder": "string", "bankName": "string", "accountNumber": "9-18 digits", "ifsc": "AAAA0XXXXXX" },
  "warehouse": { "address": "string", "pincode": "string", "pickupContact": "10-digit mobile" },
  "agreement": { "accepted": true, "version": "string" }
}
```

**Category validation (changed 2026-11-05, from the session that owns the part-category tree):** `categories`/`otherCategory` are gone.
`categoryIds` are ids of the two-level `public."Category"` tree (migration `20261105000000_vendor_part_categories`: `Category.parentId`),
normalised so a **group id means the whole group**. Valid ids are active top-level categories that have at least one active child, plus those
active children. Public read endpoint for the picker: `GET /api/part-categories` -> `{ groups: [{ id, name, slug, children: [{ id, name, slug }] }] }`.
The Java registration service must call the shared validator (`com.motoxplus.api.catalog.PartCategoryValidator` / `PartCategoryRepository`,
being added by that session) and must not re-implement the rule. Marketplace sellers get their **own** link table in schema `marketplace`
(e.g. `vendor_part_category`), not the procurement `public."VendorPartCategory"`, because sellers do not reuse `public."Vendor"`.

### Responses
| Status | Body | Frontend behaviour |
|---|---|---|
| 201 | `{ "userId": "...", "vendorId": "...", "status": "PENDING_VERIFICATION", "emailVerificationRequired": true, "mobileVerificationRequired": true }` | Success panel, link to existing `/verify-email?userId=...` then `/verify-mobile`. **A 2xx without `userId` is treated as a failure.** |
| 400 / 413 / 415 / 422 | `{ "error", "code": "VALIDATION_FAILED", "fieldErrors": { "<payload field or file part>": "message" } }` | Jumps to the step owning the first field and shows each message. |
| 409 | `{ "error": "Email already registered" \| "Mobile number already registered" }` | Account step, field error. (Same wording as today's routes; note this reveals account existence.) |
| 429 | `{ "error", "code": "RATE_LIMITED", "retryAfterSeconds" }` | Message with wait time. Use the `RateLimitBudgets` pattern (per-IP). |
| 404 / 405 / 501 / 502 / 503 / 504, network failure | any | "Not available right now - your application has not been submitted." Draft kept in memory. |

### Server behaviour the UI assumes
* Creates the user (role `SELLER`; add to Prisma `UserRole` in Phase 2), the seller record in status `PENDING_VERIFICATION`, and sends the email
  and mobile OTPs through the **existing** OTP services, so the existing `/verify-email` and `/verify-mobile` pages work unchanged.
* Stores the agreement `version` and acceptance time with the application. The seller agreement text itself does not exist yet (needs legal);
  the page links to `NEXT_PUBLIC_SELLER_AGREEMENT_URL` (default `/terms`) and sends `NEXT_PUBLIC_SELLER_AGREEMENT_VERSION` (default `"unpublished"`).
* PAN, GSTIN and bank details are encrypted at rest, masked in every API response, and never logged. No verification result is ever set by this call
  (GSTIN/PAN/bank verification are separate, admin/provider-driven steps).
* Idempotent against double-submit: the same email+mobile while an application is `PENDING_VERIFICATION` must not create a second one.
