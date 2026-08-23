# Delhivery Integration Audit — Phase 0

Audit only. No code changed. Read `src/lib/delhivery/` in full, every call site,
`src/lib/shiprocket/` for comparison, `src/app/api/webhooks/delhivery/route.ts`,
and the relevant Prisma models.

---

## 1. What exists

| Endpoint | File | Payload | Response parsing | Error handling |
|---|---|---|---|---|
| `GET /c/api/pin-codes/json/?filter_codes=` | [serviceability.ts](../src/lib/delhivery/serviceability.ts) | pincode only, validated `^\d{6}$` client-side first | `data[0]` read for `express_capable/prepaid/cod/pickup/city/state/delivery_days` | try/catch, returns a graceful `{serviceable:false, error}` object — never throws to caller |
| `GET /api/kinko/v1/rate-calculator/` | [rates.ts](../src/lib/delhivery/rates.ts) | query params `md,ss,d,o,dc,cgm,pt,cod` | `total_amount/freight_charge/cod_charges/fuel_surcharge` | try/catch swallowed, falls through to DB rate slabs, then a flat ₹100 default — resilient by design |
| `POST /api/cmu/create.json` | [shipment.ts](../src/lib/delhivery/shipment.ts) | form-encoded `format=json&data=<JSON>`, one shipment object (fields listed in §3) | `response.packages[0]`, checks `success` and `status === "Success"` | throws on `!success`, throws on package-level `status !== "Success"` — this part is correct. **But see §5: the request itself is not protected from retry.** |
| `GET /api/v1/packages/json/?waybill=&verbose=0` | [tracking.ts](../src/lib/delhivery/tracking.ts) | waybill only | `ShipmentData[0].Shipment` + `.Scans[]`, mapped to internal `TrackingResult` | try/catch, returns a degraded but non-throwing result on failure |
| Webhook receiver | [webhook.ts](../src/lib/delhivery/webhook.ts) + [route.ts](../src/app/api/webhooks/delhivery/route.ts) | Delhivery-pushed JSON or form body | reads `status`/`package-status`, `location`/`current-location`, etc. | unknown waybill → logged, `processed:false`, still 200s |

`src/lib/delhivery/index.ts` is the public surface: `checkServiceability`, `calculateShippingRate`, `calculateOrderWeight`, `createDelhiveryShipment`, `fetchLiveTracking`, `syncTrackingToDb`, `processDelhiveryWebhook`.

No `config.ts`, no sanitizer, no `api_call_log` table or equivalent, no typed `DelhiveryApiError` — confirmed absent by grep, not just unused.

---

## 2. What's live

**Delhivery is live. Shiprocket is dead code.**

Delhivery call sites (traced from `@/lib/delhivery` imports):
- [orders/route.ts:254](../src/app/api/orders/route.ts#L254) — COD orders, fire-and-forget `createDelhiveryShipment` on order creation
- [payments/finalize.ts:99](../src/lib/payments/finalize.ts#L99) — prepaid orders, fire-and-forget on payment finalize
- [admin/shipments/route.ts](../src/app/api/admin/shipments/route.ts) — admin manual create + list
- [shipping/serviceability/route.ts](../src/app/api/shipping/serviceability/route.ts) — public pincode check, **no rate limiting**
- [shipping/estimate/route.ts](../src/app/api/shipping/estimate/route.ts) — rate calc
- [orders/[id]/tracking/route.ts](../src/app/api/orders/[id]/tracking/route.ts) — customer/dealer tracking, refreshes if stale >30min
- [webhooks/delhivery/route.ts](../src/app/api/webhooks/delhivery/route.ts) — inbound status pushes

`src/lib/shiprocket/` (`client.ts`, `auth.ts`, `errors.ts`, `index.ts`) has **zero import references anywhere outside its own directory**. It is fully built (token refresh, 401 retry-once, redaction, tests) but not wired to a single route or business-logic call. It is not handling any orders — Delhivery is the only carrier actually in the request path.

---

## 3. The verified payload

**Caveat up front, stated plainly: nothing below is "verified against the live API."** It is extracted from what the code currently *sends and expects*, written by whoever built this in June/July. `delhivery-reference.md` has always been a blank template — there is no record anywhere in this repo of an actual captured request/response pair. I've written the code-derived shape into `delhivery-reference.md` and marked it as such; it still needs a real captured call to become "verified" in the sense CLAUDE.md means.

### create.json — request shape (from `shipment.ts`)
All fields are explicitly set by the code (none are optional/undefined) except `waybill`, `length`, `height`, `breadth`, which are typed as optional in `types.ts` but **never populated** by `shipment.ts` — dimensions are never sent. That's inferred from absence, not from a spec.

Hardcoded/defaulted values worth flagging:
- `country: "India"` — hardcoded, fine for this business but hardcoded nonetheless
- `shipping_mode: "Surface"` — always Surface, never Express, hardcoded
- `address_type: "office"` — always "office", never "home", hardcoded
- `hsn_code` — only the **first** line item's HSN is sent for the whole shipment (`order.items[0]?.product.hsnCode || "87141090"`), not per-line-item as Phase 3 assumes
- `seller_gst_tin` — reads `NEXT_PUBLIC_COMPANY_GST`, a `NEXT_PUBLIC_*` var. That's a client-exposed env var being reused server-side; not a leak by itself (GST numbers aren't secret) but it's the wrong pattern to copy for anything that *is* sensitive
- Return-address fields (`return_pin/city/phone/name/add/state`) come from `DELHIVERY_PICKUP_*` env vars with hardcoded fallback literals baked into the source (a real address and phone number, as literal defaults) — see §5

### create.json — response shape (from `types.ts`, matches how `shipment.ts` reads it)
`packages[{refnum, status, waybill, sort_code?, remarks}], upload_wbn?, success, total, rmk?, error?` — this matches typical Delhivery docs shape but again, not captured from a live call.

### Tracking response shape (from `types.ts` / `tracking.ts`)
`ShipmentData[].{Shipment:{AWB, Destination, DestinationCity, ExpectedDeliveryDate, Origin, OriginCity, Consignee:{...}, Status:{Status, StatusDateTime, StatusLocation, Instructions, StatusType}, ReferenceNo, PaymentMode, TotalAmount, CODAmount}, Scans:[{ScanDetail:{Scan, ScanDateTime, ScanType, ScannedLocation, Instructions, StatusDateTime}}]}` — this one plausibly *was* checked against a real response at some point, since `tracking.ts` reads nested optional chains defensively (`Shipment.Status?.Status`), which reads like someone hit real inconsistent data. Still not documented anywhere.

I did not invent new fields beyond what the code already assumes — this is a transcription of existing code, not new guessing.

---

## 4. Gap analysis vs. the 10-phase spec

| Phase | Status | Evidence |
|---|---|---|
| 1 — Client layer (config, http client, encoder, sanitizer, api_call_log, typed models) | **PARTIAL** | HTTP client exists but wrong env var name ([client.ts:2](../src/lib/delhivery/client.ts#L2) reads `DELHIVERY_API_TOKEN`, `.env` only defines `DELHIVERY_TOKEN`), no config module, no sanitizer, no api_call_log, no `DelhiveryApiError` type, no dry-run/kill-switch |
| 2 — Serviceability at checkout | **PARTIAL** | Endpoint and Redis-less live-call-through exist; no Redis caching, no rate limiting, no fail-open/fail-closed COD-vs-prepaid distinction (there's no COD/prepaid branching at all in serviceability), no debounced frontend field found |
| 3 — Payment → shipment | **PARTIAL** | `createDelhiveryShipment` exists and does DB-level idempotency via unique `orderId`, but: no advisory lock (race described in §5), no re-check of serviceability before manifesting, no e-waybill >₹50k handling, no dry-run mode, no `MANIFEST_FAILED` order state (not in the `OrderStatus` enum), no admin retry endpoint, no queue — it's called inline (fire-and-forget, not awaited) from the payment path |
| 4 — Labels and pickup | **MISSING** | No label service, no pickup service, no pickups table, no cron, no admin bulk UI found |
| 5 — Tracking webhook | **PARTIAL** | Endpoint exists with real auth (timing-safe compare) and fails closed in prod. But: auth is a query-param token, not a header; no dedupe (`shipmentTrackingEvent.create`, not upsert — see §5); no out-of-order protection; no `delhivery_status_map` table (mapping is a hardcoded object in `types.ts`); unrecognized status silently becomes `IN_TRANSIT`, not `UNKNOWN`; no domain event emission; no replay endpoint |
| 6 — Reconciliation pull | **MISSING** | No cron, no token-bucket limiter, no SLA table, no reconciliation metric |
| 7 — Customer tracking | **PARTIAL** | `GET /api/orders/:id/tracking` exists with real ownership checks (dealer IDOR check present). No milestone-stepper component found in a quick pass, no distinct NDR/RTO/lost copy, no notification dedupe (no notification code found at all) |
| 8 — NDR handling | **MISSING** | No `ndr_records` table, no NDR queue, no UPL polling |
| 9 — Refunds / reverse pickup | **MISSING** | No refund logic, no RVP creation, no QC task, no COD remittance report |
| 10 — Resilience/observability | **MISSING** | No mock server, no integration test suite for sequences, no alerting, no runbook, no dashboard |

---

## 5. Risk register (ranked)

**CRITICAL — create.json can be retried automatically, right now.**
`delhiveryPost()` in [client.ts:67](../src/lib/delhivery/client.ts#L67) calls `delhiveryFetch()` without overriding `retries`, so it inherits the default of 3. `delhiveryFetch`'s catch-and-retry loop retries on *any* non-ok response that isn't a 401, and separately retries 429s with backoff — with no method- or path-based exclusion anywhere in the code. A transient 5xx or timeout from Delhivery on `/api/cmu/create.json` is retried up to 3 times. Delhivery may have already accepted the first attempt before returning a bad status/timing out client-side — this is the exact duplicate-shipment scenario CLAUDE.md's rule exists to prevent, and there is currently no code enforcing it.

**CRITICAL (to verify) — the API token may not be wired at all.**
`client.ts` reads `DELHIVERY_API_TOKEN`; the repo's `.env` only defines `DELHIVERY_TOKEN`. If production's environment mirrors this file (I can't see production env vars, only this repo's `.env`), every Delhivery call has been sending `Authorization: Token ` with an empty token since this module's first commit (2026-06-20). That would mean serviceability checks, rate lookups, and shipment creation have been silently failing for two months — "silently" because every call site either swallows the error into a graceful fallback (serviceability, rates) or fire-and-forgets into `console.error` with no alerting (shipment creation on both COD and prepaid order paths). **This needs verification against the actual deployment's env vars before assuming it's broken, but if confirmed, no order has ever been manifested through this code path.**

**HIGH — double-manifest race, no lock.**
`createDelhiveryShipment` checks `if (order.shipment) throw` then later does `prisma.shipment.create`. Between those two, nothing prevents a second concurrent call (e.g., a webhook retry racing an admin click, or two requests hitting `payments/finalize.ts` near-simultaneously) from also passing the null check and also POSTing to `create.json`. The DB's `orderId @unique` constraint stops a second row, but only *after* both calls have already hit Delhivery — so this can produce two real AWBs for one order, with the second silently discarded at the DB layer while the shipment exists at Delhivery's end untracked.

**HIGH — no sanitization of `& # % ; \` anywhere.**
Grepped `src/lib/delhivery/` for a sanitizer — none exists. `shipment.ts` passes `destAddress`, `destName`, `productDesc`, etc. straight from `order`/`dealer` records into the payload. A dealer address containing `&` (very plausible for Indian addresses — "Shop No. 4 & 5, ...") goes to Delhivery unescaped.

**HIGH — no raw request/response logging anywhere.**
No `api_call_log` table, no equivalent. All error paths use `console.error`/`console.warn` with a summarized message, not the raw payload. If a shipment or charge is ever disputed, there is no record to point to.

**MEDIUM — webhook has no dedupe or out-of-order protection.**
`processDelhiveryWebhook` unconditionally `create`s a `ShipmentTrackingEvent` row (not an upsert with a dedupe key — contrast with `tracking.ts`'s own `syncTrackingToDb`, which upserts on a synthetic `${shipmentId}_${timestamp}` id). A replayed webhook produces a duplicate event row. There is also no check that the incoming `status_datetime` is newer than the shipment's last update, so a late/out-of-order webhook can move `Shipment.status` backwards. No refund or notification logic exists yet to be double-triggered by this — but the tracking history itself is not trustworthy today.

**MEDIUM — unrecognized status silently becomes `IN_TRANSIT`, not `UNKNOWN`.**
[types.ts:206](../src/lib/delhivery/types.ts#L206): `normalizeShipmentStatus`'s fallback (no substring match) returns `"IN_TRANSIT"`. A garbage or new-to-Delhivery status string is indistinguishable from a genuine in-transit scan — no alerting, no visibility. Full current list of matched substrings: `manifested, in transit, intransit, picked up, pickup, out for delivery, delivered, delivery failed, undelivered, rto initiated, rto delivered, return, cancelled`.

**LOW — webhook secret passed as a URL query param, not a header.**
Functionally it's still a compared secret with `timingSafeEqual` and fails closed in production, so this isn't a bypass. But query params are more likely to be captured in access logs, browser history (if ever hit manually), or proxy logs than a header would be. Phase 5's header-based design is the better pattern going forward.

**LOW — token is not reachable from client code and is never logged.**
Checked: `client.ts` is server-only (no `"use client"`, not imported by any component), the token is only interpolated into the `Authorization` header, and thrown errors carry response body text, not headers. No leak found here — this is the one item that's already in good shape.

**Not yet assessable — Shiprocket.**
Since it's dead code with no call sites, its risk surface doesn't matter for current production traffic. Worth a decision (delete vs. keep as a documented fallback carrier) at some point, but out of scope for this audit.
