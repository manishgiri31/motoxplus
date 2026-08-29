# Delhivery Integration Reference — VERIFIED, do not guess

> **STATUS: MOSTLY VERIFIED**, as of live capture runs 2026-08-23 through
> 2026-08-25 (raw pairs below under "CAPTURED"). Pincode serviceability, bulk
> waybill fetch, create order, track, and cancel are all real, live-verified
> — including a full create → track → cancel → re-track → cancel-again cycle
> on AWB 57930810000066. Only the rate-calculator endpoint remains
> code-derived/unverified. Where a captured response contradicts Delhivery's
> own published docs, the capture wins — noted inline below.

## Account
- Client / HQ name (exact): `c80988-MOTOXPLUSINDIAPRIVAT-do` — this is the
  **Domestic client** (Prepaid/COD forward shipments). This is the only
  client this codebase and the capture script target.
- Registered `pickup_location.name` (exact, case-sensitive): **`Manish Giri`**.
  Immutable in the Delhivery dashboard (field disabled on edit) — this is the
  real join key `pickup_location.name` must match on `create.json`.
  **Correction to an earlier version of this doc**: it listed "Warehouse
  name" as `"MotoXPlus India Pvt. Ltd."` — that's wrong for this purpose.
  That string is `return_name` (the RTO/return-address contact), a
  completely separate field from `pickup_location.name`. Confirmed via a
  real successful create.json + track response: the 2026-08-24 capture's
  track response shows `"PickupLocation": "Manish Giri"`.
- Warehouse/pickup pincode: `110046`
- Seller GST TIN: `07AAUCM5765B1Z4`
- Environment token works against: production (base URL `track.delhivery.com`)
- Default pickup slot: Evening 14:00–18:00 IST. Shipments manifested after
  18:00 stay in Manifested until the next day's slot — not a tracking bug.
- `pickup_location.city`: `"New Delhi"` is capture-confirmed working; the
  dashboard itself says `"Delhi"`. Didn't matter either way — don't
  re-investigate.
- **2026-08-29 re-verification**: the registered pickup address was changed
  in the Delhivery dashboard (new physical location: Khasra No. 4443,
  Nasirpur Village, Palam, New Delhi 45). The dashboard's Pickup Locations
  list shows a single row with "Created On: 28 Aug, 2026" and a display name
  of "Motoxplus" (Facility Name), which raised a real concern that the old
  location had been deleted and recreated with a different
  `pickup_location.name`. **Live-tested and confirmed false**: a real
  create.json call with `pickup_location.name: "Manish Giri"` still
  succeeded (AWB `57930810000081`, track response `"PickupLocation": "Manish
  Giri"`) — the name join key survived the address edit unchanged. The
  dashboard's "Facility Name" / list display name is cosmetic and unrelated
  to the API's `pickup_location.name`. `DELHIVERY_PICKUP_ADDRESS` /
  `return_add` were updated in both local and production `.env` to the new
  address; `DELHIVERY_PICKUP_LOCATION_NAME` was left untouched (still
  correct).
- **Cancel confirmation caveat (2026-08-29)**: on AWB `57930810000081`, the
  cancel call itself returned the normal
  `<status>True</status><remark>Shipment has been cancelled.</remark>`
  (twice, idempotently), but the tracking API's `Status.Instructions` never
  flipped to "Seller cancelled the order"/`DTUP-210` even after ~2 minutes
  (vs. ~90s on the 2026-08-24 capture). Treat the cancel endpoint's own
  `<status>True</status>` response as authoritative; don't assume failure
  just because `Status.Instructions` on the tracking endpoint is slow or
  never updates for a given shipment.
- **Second client on the same login: "MOTOXPLUS INDIA 7342 B2B" (B2B
  Surface)** — separate wallet, separate API surface. Nothing in this
  codebase or the capture script targets this client; every real call so far
  has gone to the Domestic client above.
- **Wallet history**: an initial reported top-up never actually landed —
  both the Domestic and B2B wallets read ₹0.00 when checked directly in the
  dashboard, so it was a failed/reversed payment, not money misrouted to the
  B2B account. A later ₹500 top-up on the Domestic client did land, confirmed
  by create.json succeeding on the very next attempt (2026-08-24 capture,
  waybill `57930810000066`).

## Verified calls
For each, paste the EXACT request and response.

### Pincode serviceability
CONFIRMED — see "1. Pincode serviceability" under CAPTURED below. Real shape
is `{ delivery_codes: [{ postal_code: {...} }] }`, not a bare array —
`src/lib/delhivery/types.ts` was fixed to match (`DelhiveryPincodeResponse`/
`DelhiveryPostalCode`) on 2026-08-24.

### Bulk waybill fetch
CONFIRMED — see "2. Bulk waybill fetch" entries under CAPTURED below.
Response is a bare JSON string (a single waybill), not an array — e.g.
`"57930810000011"`. Requires `cl=<DELHIVERY_CLIENT_NAME>` as a query param
alongside the Authorization header.

### Create order (manifest)
CONFIRMED SUCCESSFUL — see "3. Create shipment (REAL)" under the
2026-08-24T18:26:57.928Z CAPTURED block below: `success:true`,
`packages[0].status:"Success"`, non-empty `packages[0].waybill`.

This attempt included `pickup_location` as a **sibling of `shipments`** (not
nested inside the shipment object) — its total absence before this fix is a
separate bug from the two balance failures below, and was never actually
tested against a funded wallet before now. `pin_code` (not `pin`) is
confirmed as the correct key inside `pickup_location`.

Confirmed real response fields on `packages[0]`: `waybill, refnum, client,
payment, cod_amount, status, sort_code, serviceable, remarks`. Status values
seen: `"Success"` and `"Fail"` — **not `"Error"`**, which the old
code-derived type guessed and was wrong; fixed in types.ts on 2026-08-24.
Top-level response also has `cash_pickups_count, package_count,
prepaid_count, pickups_count, replacement_count, cash_pickups, cod_amount,
cod_count, upload_wbn, success` — `total` appeared in the two failure
responses below but not in the success response; unconfirmed whether it's
always present.

Two earlier attempts on the same wallet both failed with "insufficient
balance" — see the two 2026-08-23 CAPTURED blocks below. Kept in this file
because they document a real, useful failure mode (and confirm the payload
fields themselves were valid before the pickup_location fix), not because
they're stale.

### Track
CONFIRMED — see captures 4, 6, 9, 10, 11 below (verbose=0/1/2 on AWB
`57930810000066`) and capture 12 (unknown AWB). Fixed in `types.ts`/
`tracking.ts` on 2026-08-25 (`DelhiveryShipment`, `DelhiveryConsignee`,
`DelhiveryScanDetail`, `fetchTrackingDetail`) — only fields confirmed by a
capture are modeled:
- No `Consignee` at `verbose=0/1`; present only at `verbose=2`. No
  `TotalAmount`/`PaymentMode` at any verbosity — deleted, not aliased; real
  fields are `InvoiceAmount`/`OrderType` (literal `"Pre-paid"` — only value
  observed so far).
- `Scans` absent at `verbose=0`, present at `1`/`2`, identical at both.
  `ScanDetail` has `StatusCode` (old type didn't). **Production now requests
  `verbose=2` explicitly** (`tracking.ts`) — `0`/`1`/`2` are confirmed strict
  supersets of each other, so this costs nothing and additionally gets
  `Consignee` for destination verification without joining back to our order.
- `Consignee.Address1`/`Address2` are empty **arrays** (`[]`), not empty
  strings, even though this shipment's create.json payload had a real street
  address — typed as `string | []` (populated shape UNVERIFIED, TODO to
  confirm from the first real customer shipment); the parser does not
  normalize `[]` to `""`.
- Unknown AWB → **HTTP 200**, shape `{Success:false, Error, rmk}`, no
  `ShipmentData` key at all (capture 12) — not a 404. `fetchTrackingDetail`
  returns `null` for this; only a real API failure throws.

### Cancel
CONFIRMED, with a real surprise — see captures 5, 7, 8 below (full cycle on
AWB `57930810000066`). **Two deliberate findings, not undocumented gaps:**

**1. The response is XML, not JSON — every other endpoint here is JSON.**
`<?xml version="1.0" encoding="utf-8"?><root><status>True</status>
<waybill>...</waybill><order_id>...</order_id><remark>Shipment has been
cancelled.</remark></root>`. `src/lib/delhivery/cancel.ts` parses this with a
small tag-walking parser (no regex, no `JSON.parse`) and types it separately
(`DelhiveryCancelResponse`) so a call site cannot type-confuse it with a
create/track response. The function's own doc comment carries this warning
too, not just this file.

**2. A second cancel on an already-cancelled AWB returns an IDENTICAL
success — there is no "already cancelled" error, by design of this finding,
not by omission.** Same HTTP 200, same XML, same `"Shipment has been
cancelled."` remark (capture 7, ~90s after capture 5). Consequences, all
implemented in `cancel.ts`:
- `cancelDelhiveryShipment`'s return value means "Delhivery accepted the
  request", **not** "this call is what newly cancelled it" — named and
  documented so no caller can read it the second way.
- Retries are safe (unlike `create.json`, which must never auto-retry) — say
  so in code so nobody adds a defensive "already cancelled" guard that
  solves a problem that doesn't exist here.
- Cancellation state is OUR DB's responsibility, not Delhivery's, since the
  API can't distinguish fresh-vs-repeat either. **Audit result**: no call
  site does or can infer cancelled-ness from this API today —
  `cancelDelhiveryShipment` didn't exist in production code before
  2026-08-25; nothing calls it yet. This is a library primitive for a future
  wiring phase, not wired into any route or order-status transition.

**Propagation delay, confirmed ~1 minute**: `Status.Status` stayed
`"Not Picked"` throughout (an immediate re-track still showed the generic
`"Shipment not received from client"` / `"X-PNP"`) — it never became
`"Returned"` or `"Cancelled"`. The real signal appeared roughly a minute
later, in `Status.Instructions` (`"Seller cancelled the order"`) /
`Status.StatusCode` (`"DTUP-210"`), not in `Status.Status`.
**Delhivery's own Cancel Order API docs are WRONG here**: they describe
Prepaid/COD packages moving to `"Returned"` on cancellation — observed
behavior for a *pre-pickup* cancellation is `"Not Picked"`, never
`"Returned"`. **Audit result for read-after-cancel**: no production code
path reads tracking immediately after triggering a cancellation today, for
the same reason as above — nothing calls `cancelDelhiveryShipment` yet. The
capture script itself was the only place this delay ever mattered, and it
now retries 3x with increasing delay rather than checking once (fixed
2026-08-25). Whoever wires cancellation into a real flow next must not
defeat this — `cancel.ts`'s doc comment says so directly.

## Known-good field values
- `DELHIVERY_ORIGIN_PINCODE=110046`, `DELHIVERY_PICKUP_*`, `COMPANY_GST`,
  and `DELHIVERY_CLIENT_NAME` (see Account above) are all confirmed accepted
  by the real API.
- `pickup_location.name` **must be exactly `"Manish Giri"`** (immutable;
  `DELHIVERY_PICKUP_LOCATION_NAME` env var) — distinct from `return_name` /
  `DELHIVERY_PICKUP_NAME` (`"MotoXPlus India Pvt. Ltd."`). Confusing these
  two is what caused the missing-pickup_location bug in the first place.
- Bulk waybill fetch requires `cl` as a query param (client/HQ name); does
  not work with header-auth alone (untested whether it would 401/400 without
  `cl` — wasn't tried, since `cl` was already known to be needed from docs).

---

## Code-derived shapes (NOT live-verified — see status note above)

Only the rate-calculator endpoint remains unverified; pincode serviceability,
create.json, and track were moved into "Verified calls" above once a real
capture confirmed (or corrected) their shape.

### `GET /api/kinko/v1/rate-calculator/` — response
```
{ total_amount, freight_charge, cod_charges, fuel_surcharge, status }
```
---

## CAPTURED — 2026-08-23T22:52:40.005Z (scripts/delhivery-capture.ts)

### 1. Pincode serviceability

REQUEST:
```
GET https://track.delhivery.com/c/api/pin-codes/json/?filter_codes=135001
Authorization: Token ***REDACTED***
Accept: application/json

```

RESPONSE: 200 OK
```
{
    "delivery_codes": [
        {
            "postal_code": {
                "remarks": "",
                "pin": 135001,
                "country_code": "IN",
                "state_code": "HR",
                "cod": "Y",
                "pre_paid": "Y",
                "pickup": "Y",
                "cash": "Y",
                "repl": "Y",
                "district": "Yamuna Nagar",
                "is_oda": "N",
                "sort_code": "CHA/RAM",
                "max_amount": 0.0,
                "max_weight": 0.0,
                "covid_zone": "G",
                "inc": "Yamunanagar_Veerngrcly_D (Haryana)",
                "center": [
                    {
                        "code": "IND135001AAA",
                        "e": "2019-03-14T10:29:36.678",
                        "cn": "YamunaNagar_DC (Haryana)",
                        "s": "2015-04-23T19:16:36.970",
                        "u": "Aayush.Agarwal",
                        "ud": "2015-04-23T19:16:36.970",
                        "sort_code": "JUD/JUD"
                    },
                    {
                        "code": "IND135003A1A",
                        "cn": "Yamunanagar_Veerngrcly_D (Haryana)",
                        "s": "2019-03-14T10:29:36.678",
                        "u": "akshay.soni3",
                        "sort_code": "IXC/MDP",
                        "ud": "2019-03-14T10:29:36.678",
                        "e": "2026-05-25T12:51:45.297"
                    },
                    {
                        "code": "INHRBGFW",
                        "sort_code": "CHA/RAM",
                        "cn": "Yamunanagar_Jagadhri_D (Haryana)",
                        "s": "2026-05-25T12:51:45.297",
                        "u": "meenakshi.negi",
                        "ud": "2026-05-25T12:51:45.297"
                    }
                ],
                "city": "Yamuna Nagar",
                "sun_tat": true,
                "protect_blacklist": false,
                "srv_wt_th": 4500.0
            }
        }
    ]
}
```

### 2. Bulk waybill fetch

REQUEST:
```
GET https://track.delhivery.com/waybill/api/bulk/json/?cl=c80988-MOTOXPLUSINDIAPRIVAT-do&count=1
Authorization: Token ***REDACTED***
Accept: application/json

```

RESPONSE: 200 OK
```
"57930810000011"
```

### 3. Create shipment (REAL)

REQUEST:
```
POST https://track.delhivery.com/api/cmu/create.json
Authorization: Token ***REDACTED***
Content-Type: application/x-www-form-urlencoded
format=json&data=%7B%22shipments%22%3A%5B%7B%22name%22%3A%22Manish+Giri%22%2C%22add%22%3A%22Haryana%22%2C%22pin%22%3A%22135001%22%2C%22city%22%3A%22Yamunanagar%22%2C%22state%22%3A%22Haryana%22%2C%22country%22%3A%22India%22%2C%22phone%22%3A%227206794749%22%2C%22order%22%3A%22CAPTURE-1787525558913%22%2C%22payment_mode%22%3A%22Prepaid%22%2C%22return_pin%22%3A%22110046%22%2C%22return_city%22%3A%22New+Delhi%22%2C%22return_phone%22%3A%229217131801%22%2C%22return_name%22%3A%22MotoXPlus+India+Pvt.+Ltd.%22%2C%22return_add%22%3A%22RZ-43%2F291%2C+Street+Number+6%2C+Geetanjli+Park%2C+Sagarpur+West%22%2C%22return_state%22%3A%22Delhi%22%2C%22return_country%22%3A%22India%22%2C%22products_desc%22%3A%22Capture+test+item%22%2C%22hsn_code%22%3A%2287141090%22%2C%22cod_amount%22%3A0%2C%22order_date%22%3A%222026-08-23%22%2C%22total_amount%22%3A100%2C%22seller_gst_tin%22%3A%2207AAUCM5765B1Z4%22%2C%22shipping_mode%22%3A%22Surface%22%2C%22address_type%22%3A%22home%22%2C%22quantity%22%3A1%2C%22weight%22%3A0.5%7D%5D%7D
```

RESPONSE: 200 OK
```
{"cash_pickups_count":0.0,"package_count":1,"prepaid_count":0,"pickups_count":0,"replacement_count":0,"cash_pickups":0.0,"cod_amount":0.0,"cod_count":0,"upload_wbn":"UPL613271465538178304","packages":[{"waybill":"","refnum":"CAPTURE-1787525558913","client":"c80988-MOTOXPLUSINDIAPRIVAT-do","payment":"Pre-paid","cod_amount":0.0,"status":"Fail","sort_code":"CHA/RAM","serviceable":true,"remarks":["Crashing while saving package due to exception 'Prepaid client manifest charge API failed due to insufficient balance'. Package might have been partially saved."]}],"success":false,"rmk":"An internal Error has occurred, Please get in touch with client.support@delhivery.com"}
```

---

## CAPTURED — 2026-08-23T23:05:06.385Z (scripts/delhivery-capture.ts)

### 1. Pincode serviceability

REQUEST:
```
GET https://track.delhivery.com/c/api/pin-codes/json/?filter_codes=135001
Authorization: Token ***REDACTED***
Accept: application/json

```

RESPONSE: 200 OK
```
{
    "delivery_codes": [
        {
            "postal_code": {
                "remarks": "",
                "pin": 135001,
                "country_code": "IN",
                "state_code": "HR",
                "cod": "Y",
                "pre_paid": "Y",
                "pickup": "Y",
                "cash": "Y",
                "repl": "Y",
                "district": "Yamuna Nagar",
                "is_oda": "N",
                "sort_code": "CHA/RAM",
                "max_amount": 0.0,
                "max_weight": 0.0,
                "covid_zone": "G",
                "inc": "Yamunanagar_Veerngrcly_D (Haryana)",
                "center": [
                    {
                        "code": "IND135001AAA",
                        "e": "2019-03-14T10:29:36.678",
                        "cn": "YamunaNagar_DC (Haryana)",
                        "s": "2015-04-23T19:16:36.970",
                        "u": "Aayush.Agarwal",
                        "ud": "2015-04-23T19:16:36.970",
                        "sort_code": "JUD/JUD"
                    },
                    {
                        "code": "IND135003A1A",
                        "cn": "Yamunanagar_Veerngrcly_D (Haryana)",
                        "s": "2019-03-14T10:29:36.678",
                        "u": "akshay.soni3",
                        "sort_code": "IXC/MDP",
                        "ud": "2019-03-14T10:29:36.678",
                        "e": "2026-05-25T12:51:45.297"
                    },
                    {
                        "code": "INHRBGFW",
                        "sort_code": "CHA/RAM",
                        "cn": "Yamunanagar_Jagadhri_D (Haryana)",
                        "s": "2026-05-25T12:51:45.297",
                        "u": "meenakshi.negi",
                        "ud": "2026-05-25T12:51:45.297"
                    }
                ],
                "city": "Yamuna Nagar",
                "sun_tat": true,
                "protect_blacklist": false,
                "srv_wt_th": 4500.0
            }
        }
    ]
}
```

### 2. Bulk waybill fetch

REQUEST:
```
GET https://track.delhivery.com/waybill/api/bulk/json/?cl=c80988-MOTOXPLUSINDIAPRIVAT-do&count=1
Authorization: Token ***REDACTED***
Accept: application/json

```

RESPONSE: 200 OK
```
"57930810000033"
```

### 3. Create shipment (REAL)

REQUEST:
```
POST https://track.delhivery.com/api/cmu/create.json
Authorization: Token ***REDACTED***
Content-Type: application/x-www-form-urlencoded
format=json&data=%7B%22shipments%22%3A%5B%7B%22name%22%3A%22Manish+Giri%22%2C%22add%22%3A%22Haryana%22%2C%22pin%22%3A%22135001%22%2C%22city%22%3A%22Yamunanagar%22%2C%22state%22%3A%22Haryana%22%2C%22country%22%3A%22India%22%2C%22phone%22%3A%227206794749%22%2C%22order%22%3A%22CAPTURE-1787526305307%22%2C%22payment_mode%22%3A%22Prepaid%22%2C%22return_pin%22%3A%22110046%22%2C%22return_city%22%3A%22New+Delhi%22%2C%22return_phone%22%3A%229217131801%22%2C%22return_name%22%3A%22MotoXPlus+India+Pvt.+Ltd.%22%2C%22return_add%22%3A%22RZ-43%2F291%2C+Street+Number+6%2C+Geetanjli+Park%2C+Sagarpur+West%22%2C%22return_state%22%3A%22Delhi%22%2C%22return_country%22%3A%22India%22%2C%22products_desc%22%3A%22Capture+test+item%22%2C%22hsn_code%22%3A%2287141090%22%2C%22cod_amount%22%3A0%2C%22order_date%22%3A%222026-08-23%22%2C%22total_amount%22%3A100%2C%22seller_gst_tin%22%3A%2207AAUCM5765B1Z4%22%2C%22shipping_mode%22%3A%22Surface%22%2C%22address_type%22%3A%22home%22%2C%22quantity%22%3A1%2C%22weight%22%3A0.5%7D%5D%7D
```

RESPONSE: 200 OK
```
{"cash_pickups_count":0.0,"package_count":1,"prepaid_count":0,"pickups_count":0,"replacement_count":0,"cash_pickups":0.0,"cod_amount":0.0,"cod_count":0,"upload_wbn":"UPL17260024178243620389","packages":[{"waybill":"","refnum":"CAPTURE-1787526305307","client":"c80988-MOTOXPLUSINDIAPRIVAT-do","payment":"Pre-paid","cod_amount":0.0,"status":"Fail","sort_code":"CHA/RAM","serviceable":true,"remarks":["Crashing while saving package due to exception 'Prepaid client manifest charge API failed due to insufficient balance'. Package might have been partially saved."]}],"success":false,"rmk":"An internal Error has occurred, Please get in touch with client.support@delhivery.com"}
```

---

## CAPTURED — 2026-08-24T18:26:57.928Z (scripts/delhivery-capture.ts)

### 1. Pincode serviceability

REQUEST:
```
GET https://track.delhivery.com/c/api/pin-codes/json/?filter_codes=135001
Authorization: Token ***REDACTED***
Accept: application/json

```

RESPONSE: 200 OK
```
{
    "delivery_codes": [
        {
            "postal_code": {
                "remarks": "",
                "pin": 135001,
                "country_code": "IN",
                "state_code": "HR",
                "cod": "Y",
                "pre_paid": "Y",
                "pickup": "Y",
                "cash": "Y",
                "repl": "Y",
                "district": "Yamuna Nagar",
                "is_oda": "N",
                "sort_code": "CHA/RAM",
                "max_amount": 0.0,
                "max_weight": 0.0,
                "covid_zone": "G",
                "inc": "Yamunanagar_Veerngrcly_D (Haryana)",
                "center": [
                    {
                        "code": "IND135001AAA",
                        "e": "2019-03-14T10:29:36.678",
                        "cn": "YamunaNagar_DC (Haryana)",
                        "s": "2015-04-23T19:16:36.970",
                        "u": "Aayush.Agarwal",
                        "ud": "2015-04-23T19:16:36.970",
                        "sort_code": "JUD/JUD"
                    },
                    {
                        "code": "IND135003A1A",
                        "cn": "Yamunanagar_Veerngrcly_D (Haryana)",
                        "s": "2019-03-14T10:29:36.678",
                        "u": "akshay.soni3",
                        "sort_code": "IXC/MDP",
                        "ud": "2019-03-14T10:29:36.678",
                        "e": "2026-05-25T12:51:45.297"
                    },
                    {
                        "code": "INHRBGFW",
                        "sort_code": "CHA/RAM",
                        "cn": "Yamunanagar_Jagadhri_D (Haryana)",
                        "s": "2026-05-25T12:51:45.297",
                        "u": "meenakshi.negi",
                        "ud": "2026-05-25T12:51:45.297"
                    }
                ],
                "city": "Yamuna Nagar",
                "sun_tat": true,
                "protect_blacklist": false,
                "srv_wt_th": 4500.0
            }
        }
    ]
}
```

### 2. Bulk waybill fetch

REQUEST:
```
GET https://track.delhivery.com/waybill/api/bulk/json/?cl=c80988-MOTOXPLUSINDIAPRIVAT-do&count=1
Authorization: Token ***REDACTED***
Accept: application/json

```

RESPONSE: 200 OK
```
"57930810000055"
```

### 3. Create shipment (REAL)

REQUEST:
```
POST https://track.delhivery.com/api/cmu/create.json
Authorization: Token ***REDACTED***
Content-Type: application/x-www-form-urlencoded
format=json&data=%7B%22shipments%22%3A%5B%7B%22name%22%3A%22Manish+Giri%22%2C%22add%22%3A%22House+No.+123%2C+Model+Town+Road%22%2C%22pin%22%3A%22135001%22%2C%22city%22%3A%22Yamunanagar%22%2C%22state%22%3A%22Haryana%22%2C%22country%22%3A%22India%22%2C%22phone%22%3A%227206794749%22%2C%22order%22%3A%22CAPTURE-1787596016179%22%2C%22payment_mode%22%3A%22Prepaid%22%2C%22return_pin%22%3A%22110046%22%2C%22return_city%22%3A%22New+Delhi%22%2C%22return_phone%22%3A%229217131801%22%2C%22return_name%22%3A%22MotoXPlus+India+Pvt.+Ltd.%22%2C%22return_add%22%3A%22RZ-43%2F291%2C+Street+Number+6%2C+Geetanjli+Park%2C+Sagarpur+West%22%2C%22return_state%22%3A%22Delhi%22%2C%22return_country%22%3A%22India%22%2C%22products_desc%22%3A%22Capture+test+item%22%2C%22hsn_code%22%3A%2287141090%22%2C%22cod_amount%22%3A0%2C%22order_date%22%3A%222026-08-24%22%2C%22total_amount%22%3A100%2C%22seller_gst_tin%22%3A%2207AAUCM5765B1Z4%22%2C%22shipping_mode%22%3A%22Surface%22%2C%22address_type%22%3A%22office%22%2C%22quantity%22%3A1%2C%22weight%22%3A0.5%7D%5D%2C%22pickup_location%22%3A%7B%22name%22%3A%22Manish+Giri%22%2C%22add%22%3A%22RZ-43%2F291%2C+Street+Number+6%2C+Geetanjli+Park%2C+Sagarpur+West%22%2C%22city%22%3A%22New+Delhi%22%2C%22pin_code%22%3A%22110046%22%2C%22country%22%3A%22India%22%2C%22phone%22%3A%229217131801%22%7D%7D
```

RESPONSE: 200 OK
```
{"cash_pickups_count":0.0,"package_count":1,"prepaid_count":1,"pickups_count":0,"replacement_count":0,"cash_pickups":0.0,"cod_amount":0.0,"cod_count":0,"upload_wbn":"UPL14784772876334680653","packages":[{"waybill":"57930810000066","refnum":"CAPTURE-1787596016179","client":"c80988-MOTOXPLUSINDIAPRIVAT-do","payment":"Pre-paid","cod_amount":0.0,"status":"Success","sort_code":"CHA/RAM","serviceable":true,"remarks":[""]}],"success":true}
```

### 4. Track

REQUEST:
```
GET https://track.delhivery.com/api/v1/packages/json/?waybill=57930810000066&verbose=0
Authorization: Token ***REDACTED***
Accept: application/json

```

RESPONSE: 200 OK
```
{
    "ShipmentData": [
        {
            "Shipment": {
                "AWB": "57930810000066",
                "CODAmount": 0,
                "ChargedWeight": null,
                "DeliveryDate": null,
                "DestRecieveDate": null,
                "Destination": "Yamunanagar",
                "DispatchCount": 0,
                "Ewaybill": [],
                "ExpectedDeliveryDate": null,
                "Extras": "",
                "FirstAttemptDate": null,
                "InvoiceAmount": 100,
                "OrderType": "Pre-paid",
                "Origin": "Delhi_Airport_GW (Delhi)",
                "OriginRecieveDate": null,
                "OutDestinationDate": null,
                "PickUpDate": "2026-08-24T23:56:59.79",
                "PickedupDate": null,
                "PickupLocation": "Manish Giri",
                "PromisedDeliveryDate": null,
                "Quantity": "1",
                "RTOStartedDate": null,
                "ReferenceNo": "CAPTURE-1787596016179",
                "ReturnPromisedDeliveryDate": null,
                "ReturnedDate": null,
                "ReverseInTransit": false,
                "SenderName": "c80988-MOTOXPLUSINDIAPRIVAT-do",
                "Status": {
                    "Instructions": "Manifest uploaded",
                    "RecievedBy": "",
                    "Status": "Manifested",
                    "StatusCode": "X-UCI",
                    "StatusDateTime": "2026-08-24T23:56:59.828",
                    "StatusLocation": "Delhi_Airport_GW (Delhi)",
                    "StatusType": "UD"
                }
            }
        }
    ]
}
```

### 5. Cancel

REQUEST:
```
POST https://track.delhivery.com/api/p/edit
Authorization: Token ***REDACTED***
Content-Type: application/json
{"waybill":"57930810000066","cancellation":"true"}
```

RESPONSE: 200 OK
```
<?xml version="1.0" encoding="utf-8"?>
<root><status>True</status><waybill>57930810000066</waybill><order_id>CAPTURE-1787596016179</order_id><remark>Shipment has been cancelled.</remark></root>
```

### 6. Track (post-cancel, confirms cancellation)

REQUEST:
```
GET https://track.delhivery.com/api/v1/packages/json/?waybill=57930810000066&verbose=0
Authorization: Token ***REDACTED***
Accept: application/json

```

RESPONSE: 200 OK
```
{
    "ShipmentData": [
        {
            "Shipment": {
                "AWB": "57930810000066",
                "CODAmount": 0,
                "ChargedWeight": null,
                "DeliveryDate": null,
                "DestRecieveDate": null,
                "Destination": "Yamunanagar",
                "DispatchCount": 0,
                "Ewaybill": [],
                "ExpectedDeliveryDate": null,
                "Extras": "",
                "FirstAttemptDate": null,
                "InvoiceAmount": 100,
                "OrderType": "Pre-paid",
                "Origin": "Delhi_Airport_GW (Delhi)",
                "OriginRecieveDate": null,
                "OutDestinationDate": null,
                "PickUpDate": "2026-08-24T23:56:59.79",
                "PickedupDate": null,
                "PickupLocation": "Manish Giri",
                "PromisedDeliveryDate": null,
                "Quantity": "1",
                "RTOStartedDate": null,
                "ReferenceNo": "CAPTURE-1787596016179",
                "ReturnPromisedDeliveryDate": null,
                "ReturnedDate": null,
                "ReverseInTransit": false,
                "SenderName": "c80988-MOTOXPLUSINDIAPRIVAT-do",
                "Status": {
                    "Instructions": "Shipment not received from client",
                    "RecievedBy": "",
                    "Status": "Not Picked",
                    "StatusCode": "X-PNP",
                    "StatusDateTime": "2026-08-24T23:57:00.373",
                    "StatusLocation": "Delhi_Airport_GW (Delhi)",
                    "StatusType": "UD"
                }
            }
        }
    ]
}
```

### 7. Cancel again (already-cancelled AWB)

Run manually (scripts/delhivery-cancel-check.ts, since the capture script's
step-6 confirmation logic false-negatived on this AWB — see the Cancel
section above and the fix noted there) — same AWB, ~90s after step 5.

REQUEST:
```
POST https://track.delhivery.com/api/p/edit
Authorization: Token ***REDACTED***
Content-Type: application/json
{"waybill":"57930810000066","cancellation":"true"}
```

RESPONSE: 200 OK
```
<?xml version="1.0" encoding="utf-8"?>
<root><status>True</status><waybill>57930810000066</waybill><order_id>CAPTURE-1787596016179</order_id><remark>Shipment has been cancelled.</remark></root>
```

Identical to the first cancel response — no "already cancelled" distinction.

### 8. Track (after cancel again — first capture showing the real cancellation signal)

REQUEST:
```
GET https://track.delhivery.com/api/v1/packages/json/?waybill=57930810000066&verbose=0
Authorization: Token ***REDACTED***
Accept: application/json
```

RESPONSE: 200 OK
```
{
    "ShipmentData": [
        {
            "Shipment": {
                "AWB": "57930810000066",
                "CODAmount": 0,
                "ChargedWeight": null,
                "DeliveryDate": null,
                "DestRecieveDate": null,
                "Destination": "Yamunanagar",
                "DispatchCount": 0,
                "Ewaybill": [],
                "ExpectedDeliveryDate": null,
                "Extras": "",
                "FirstAttemptDate": null,
                "InvoiceAmount": 100,
                "OrderType": "Pre-paid",
                "Origin": "Delhi_Airport_GW (Delhi)",
                "OriginRecieveDate": null,
                "OutDestinationDate": null,
                "PickUpDate": "2026-08-24T23:56:59.79",
                "PickedupDate": null,
                "PickupLocation": "Manish Giri",
                "PromisedDeliveryDate": null,
                "Quantity": "1",
                "RTOStartedDate": null,
                "ReferenceNo": "CAPTURE-1787596016179",
                "ReturnPromisedDeliveryDate": null,
                "ReturnedDate": null,
                "ReverseInTransit": false,
                "SenderName": "c80988-MOTOXPLUSINDIAPRIVAT-do",
                "Status": {
                    "Instructions": "Seller cancelled the order",
                    "RecievedBy": "",
                    "Status": "Not Picked",
                    "StatusCode": "DTUP-210",
                    "StatusDateTime": "2026-08-24T23:58:39.774",
                    "StatusLocation": "Delhi_Airport_GW (Delhi)",
                    "StatusType": "UD"
                }
            }
        }
    ]
}
```

`Status.Status` is still `"Not Picked"` (never became "Cancelled"/"Returned"),
but `Instructions` and `StatusCode` now clearly confirm the cancellation.
AWB `57930810000066` is genuinely cancelled.

---

## CAPTURED — 2026-08-24T18:37:07.000Z (scripts/delhivery-track-verbosity-check.ts, manual — Part 1 discovery)

Same AWB (`57930810000066`, cancelled), same endpoint, `verbose=0` vs `verbose=1`
vs `verbose=2` — to determine the real, honest shape of the track response
before touching `types.ts`/`tracking.ts`. No new shipment created.

### 9. Track verbose=0

REQUEST:
```
GET https://track.delhivery.com/api/v1/packages/json/?waybill=57930810000066&verbose=0
Authorization: Token ***REDACTED***
Accept: application/json
```

RESPONSE: 200 OK
```
{
    "ShipmentData": [
        {
            "Shipment": {
                "AWB": "57930810000066",
                "CODAmount": 0,
                "ChargedWeight": null,
                "DeliveryDate": null,
                "DestRecieveDate": null,
                "Destination": "Yamunanagar",
                "DispatchCount": 0,
                "Ewaybill": [],
                "ExpectedDeliveryDate": null,
                "Extras": "",
                "FirstAttemptDate": null,
                "InvoiceAmount": 100,
                "OrderType": "Pre-paid",
                "Origin": "Delhi_Airport_GW (Delhi)",
                "OriginRecieveDate": null,
                "OutDestinationDate": null,
                "PickUpDate": "2026-08-24T23:56:59.79",
                "PickedupDate": null,
                "PickupLocation": "Manish Giri",
                "PromisedDeliveryDate": null,
                "Quantity": "1",
                "RTOStartedDate": null,
                "ReferenceNo": "CAPTURE-1787596016179",
                "ReturnPromisedDeliveryDate": null,
                "ReturnedDate": null,
                "ReverseInTransit": false,
                "SenderName": "c80988-MOTOXPLUSINDIAPRIVAT-do",
                "Status": {
                    "Instructions": "Seller cancelled the order",
                    "RecievedBy": "",
                    "Status": "Not Picked",
                    "StatusCode": "DTUP-210",
                    "StatusDateTime": "2026-08-24T23:58:39.774",
                    "StatusLocation": "Delhi_Airport_GW (Delhi)",
                    "StatusType": "UD"
                }
            }
        }
    ]
}
```

### 10. Track verbose=1

REQUEST:
```
GET https://track.delhivery.com/api/v1/packages/json/?waybill=57930810000066&verbose=1
Authorization: Token ***REDACTED***
Accept: application/json
```

RESPONSE: 200 OK
```
{
    "ShipmentData": [
        {
            "Shipment": {
                "AWB": "57930810000066",
                "CODAmount": 0,
                "ChargedWeight": null,
                "DeliveryDate": null,
                "DestRecieveDate": null,
                "Destination": "Yamunanagar",
                "DispatchCount": 0,
                "Ewaybill": [],
                "ExpectedDeliveryDate": null,
                "Extras": "",
                "FirstAttemptDate": null,
                "InvoiceAmount": 100,
                "OrderType": "Pre-paid",
                "Origin": "Delhi_Airport_GW (Delhi)",
                "OriginRecieveDate": null,
                "OutDestinationDate": null,
                "PickUpDate": "2026-08-24T23:56:59.79",
                "PickedupDate": null,
                "PickupLocation": "Manish Giri",
                "PromisedDeliveryDate": null,
                "Quantity": "1",
                "RTOStartedDate": null,
                "ReferenceNo": "CAPTURE-1787596016179",
                "ReturnPromisedDeliveryDate": null,
                "ReturnedDate": null,
                "ReverseInTransit": false,
                "Scans": [
                    {
                        "ScanDetail": {
                            "Instructions": "Manifest uploaded",
                            "Scan": "Manifested",
                            "ScanDateTime": "2026-08-24T23:56:59.828",
                            "ScanType": "UD",
                            "ScannedLocation": "Delhi_Airport_GW (Delhi)",
                            "StatusCode": "X-UCI",
                            "StatusDateTime": "2026-08-24T23:56:59.828"
                        }
                    },
                    {
                        "ScanDetail": {
                            "Instructions": "Shipment not received from client",
                            "Scan": "Not Picked",
                            "ScanDateTime": "2026-08-24T23:57:00.373",
                            "ScanType": "UD",
                            "ScannedLocation": "Delhi_Airport_GW (Delhi)",
                            "StatusCode": "X-PNP",
                            "StatusDateTime": "2026-08-24T23:57:00.373"
                        }
                    },
                    {
                        "ScanDetail": {
                            "Instructions": "Seller cancelled the order",
                            "Scan": "Not Picked",
                            "ScanDateTime": "2026-08-24T23:58:39.774",
                            "ScanType": "UD",
                            "ScannedLocation": "Delhi_Airport_GW (Delhi)",
                            "StatusCode": "DTUP-210",
                            "StatusDateTime": "2026-08-24T23:58:39.774"
                        }
                    }
                ],
                "SenderName": "c80988-MOTOXPLUSINDIAPRIVAT-do",
                "Status": {
                    "Instructions": "Seller cancelled the order",
                    "RecievedBy": "",
                    "Status": "Not Picked",
                    "StatusCode": "DTUP-210",
                    "StatusDateTime": "2026-08-24T23:58:39.774",
                    "StatusLocation": "Delhi_Airport_GW (Delhi)",
                    "StatusType": "UD"
                }
            }
        }
    ]
}
```

### 11. Track verbose=2

REQUEST:
```
GET https://track.delhivery.com/api/v1/packages/json/?waybill=57930810000066&verbose=2
Authorization: Token ***REDACTED***
Accept: application/json
```

RESPONSE: 200 OK
```
{
    "ShipmentData": [
        {
            "Shipment": {
                "AWB": "57930810000066",
                "CODAmount": 0,
                "ChargedWeight": null,
                "Consignee": {
                    "Address1": [],
                    "Address2": [],
                    "Address3": "",
                    "City": "Yamunanagar",
                    "Country": "India",
                    "Name": "Manish Giri",
                    "PinCode": 135001,
                    "State": "Haryana",
                    "Telephone1": "",
                    "Telephone2": ""
                },
                "DeliveryDate": null,
                "DestRecieveDate": null,
                "Destination": "Yamunanagar",
                "DispatchCount": 0,
                "Ewaybill": [],
                "ExpectedDeliveryDate": null,
                "Extras": "",
                "FirstAttemptDate": null,
                "InvoiceAmount": 100,
                "OrderType": "Pre-paid",
                "Origin": "Delhi_Airport_GW (Delhi)",
                "OriginRecieveDate": null,
                "OutDestinationDate": null,
                "PickUpDate": "2026-08-24T23:56:59.79",
                "PickedupDate": null,
                "PickupLocation": "Manish Giri",
                "PromisedDeliveryDate": null,
                "Quantity": "1",
                "RTOStartedDate": null,
                "ReferenceNo": "CAPTURE-1787596016179",
                "ReturnPromisedDeliveryDate": null,
                "ReturnedDate": null,
                "ReverseInTransit": false,
                "Scans": [
                    {
                        "ScanDetail": {
                            "Instructions": "Manifest uploaded",
                            "Scan": "Manifested",
                            "ScanDateTime": "2026-08-24T23:56:59.828",
                            "ScanType": "UD",
                            "ScannedLocation": "Delhi_Airport_GW (Delhi)",
                            "StatusCode": "X-UCI",
                            "StatusDateTime": "2026-08-24T23:56:59.828"
                        }
                    },
                    {
                        "ScanDetail": {
                            "Instructions": "Shipment not received from client",
                            "Scan": "Not Picked",
                            "ScanDateTime": "2026-08-24T23:57:00.373",
                            "ScanType": "UD",
                            "ScannedLocation": "Delhi_Airport_GW (Delhi)",
                            "StatusCode": "X-PNP",
                            "StatusDateTime": "2026-08-24T23:57:00.373"
                        }
                    },
                    {
                        "ScanDetail": {
                            "Instructions": "Seller cancelled the order",
                            "Scan": "Not Picked",
                            "ScanDateTime": "2026-08-24T23:58:39.774",
                            "ScanType": "UD",
                            "ScannedLocation": "Delhi_Airport_GW (Delhi)",
                            "StatusCode": "DTUP-210",
                            "StatusDateTime": "2026-08-24T23:58:39.774"
                        }
                    }
                ],
                "SenderName": "c80988-MOTOXPLUSINDIAPRIVAT-do",
                "Status": {
                    "Instructions": "Seller cancelled the order",
                    "RecievedBy": "",
                    "Status": "Not Picked",
                    "StatusCode": "DTUP-210",
                    "StatusDateTime": "2026-08-24T23:58:39.774",
                    "StatusLocation": "Delhi_Airport_GW (Delhi)",
                    "StatusType": "UD"
                }
            }
        }
    ]
}
```

### Part 1 findings

- **Scans array**: absent at `verbose=0`, present at `verbose=1` and `verbose=2`
  (identical 3-entry array at both). Real shape is
  `{ ScanDetail: { Instructions, Scan, ScanDateTime, ScanType, ScannedLocation,
  StatusCode, StatusDateTime } }` — note `StatusCode` **is** present inside
  `ScanDetail` in the real response; the old code-derived type didn't have it.
- **Consignee**: absent at `verbose=0` and `verbose=1`, present only at
  `verbose=2`. Real shape: `{ Address1, Address2, Address3, City, Country,
  Name, PinCode, State, Telephone1, Telephone2 }`. Quirk: `Address1` and
  `Address2` came back as **empty arrays `[]`**, not empty strings, and
  `Address3` as an empty string — despite the shipment having a real street
  address (`"House No. 123, Model Town Road"`) in the original create.json
  payload. Never observed non-empty, so the true populated type of
  `Address1`/`Address2` (string? string[]?) is unconfirmed — typed
  conservatively rather than guessed. `PinCode` is a **number** (`135001`),
  same numeric-pincode quirk seen in the serviceability endpoint.
- **PaymentMode / TotalAmount**: never appear at any verbosity, confirming
  they are not real fields — the real equivalents are `OrderType`
  (`"Pre-paid"`) and `InvoiceAmount` (`100`).
- **Nothing present at `verbose=0` disappears at higher verbosity** — `1` and
  `2` are strict supersets of `0` (verbose=1 adds `Scans`; verbose=2 adds
  `Consignee` on top of that). No field was ever seen to vanish.
- `verbose=2` was accepted normally (200 OK, no rejection, no error) —
  contrary to what might be assumed, it's not an invalid/reserved value.

---

## CAPTURED — 2026-08-25 (scripts/delhivery-unknown-awb-check.ts, manual — Part 2 discovery)

Read-only GET on a waybill that doesn't exist (`00000000000000`), needed to
build honest "unknown AWB → null" handling instead of guessing the shape.
No shipment created.

### 12. Track, nonexistent AWB

REQUEST:
```
GET https://track.delhivery.com/api/v1/packages/json/?waybill=00000000000000&verbose=2
Authorization: Token ***REDACTED***
Accept: application/json
```

RESPONSE: 200 OK
```
{
    "Success": false,
    "Error": "Data does not exists for provided Waybill(s)",
    "rmk": "Some error has occurred. Please contact client.support@delhivery.com with error message- Data does not exists for provided Waybill(s)"
}
```

**Important**: HTTP 200, not 404. Completely different top-level shape from
the normal response (`{Success, Error, rmk}`, no `ShipmentData` key at all) —
this is the only way to detect "unknown AWB" and it must be checked by shape,
not by HTTP status.

---

## CAPTURED — 2026-08-29T04:47:07.454Z (scripts/delhivery-capture.ts)

### 1. Pincode serviceability

REQUEST:
```
GET https://track.delhivery.com/c/api/pin-codes/json/?filter_codes=135001
Authorization: Token ***REDACTED***
Accept: application/json

```

RESPONSE: 200 OK
```
{
    "delivery_codes": [
        {
            "postal_code": {
                "remarks": "",
                "pin": 135001,
                "country_code": "IN",
                "state_code": "HR",
                "cod": "Y",
                "pre_paid": "Y",
                "pickup": "Y",
                "cash": "Y",
                "repl": "Y",
                "district": "Yamuna Nagar",
                "is_oda": "N",
                "sort_code": "CHA/RAM",
                "max_amount": 0.0,
                "max_weight": 0.0,
                "covid_zone": "G",
                "inc": "Yamunanagar_Veerngrcly_D (Haryana)",
                "center": [
                    {
                        "code": "IND135001AAA",
                        "e": "2019-03-14T10:29:36.678",
                        "cn": "YamunaNagar_DC (Haryana)",
                        "s": "2015-04-23T19:16:36.970",
                        "u": "Aayush.Agarwal",
                        "ud": "2015-04-23T19:16:36.970",
                        "sort_code": "JUD/JUD"
                    },
                    {
                        "code": "IND135003A1A",
                        "cn": "Yamunanagar_Veerngrcly_D (Haryana)",
                        "s": "2019-03-14T10:29:36.678",
                        "u": "akshay.soni3",
                        "sort_code": "IXC/MDP",
                        "ud": "2019-03-14T10:29:36.678",
                        "e": "2026-05-25T12:51:45.297"
                    },
                    {
                        "code": "INHRBGFW",
                        "sort_code": "CHA/RAM",
                        "cn": "Yamunanagar_Jagadhri_D (Haryana)",
                        "s": "2026-05-25T12:51:45.297",
                        "u": "meenakshi.negi",
                        "ud": "2026-05-25T12:51:45.297"
                    }
                ],
                "city": "Yamuna Nagar",
                "sun_tat": true,
                "protect_blacklist": false,
                "srv_wt_th": 4500.0
            }
        }
    ]
}
```

### 2. Bulk waybill fetch

REQUEST:
```
GET https://track.delhivery.com/waybill/api/bulk/json/?cl=c80988-MOTOXPLUSINDIAPRIVAT-do&count=1
Authorization: Token ***REDACTED***
Accept: application/json

```

RESPONSE: 200 OK
```
"57930810000070"
```

### 3. Create shipment (REAL)

REQUEST:
```
POST https://track.delhivery.com/api/cmu/create.json
Authorization: Token ***REDACTED***
Content-Type: application/x-www-form-urlencoded
format=json&data=%7B%22shipments%22%3A%5B%7B%22name%22%3A%22Manish+Giri%22%2C%22add%22%3A%22House+No.+123%2C+Model+Town+Road%22%2C%22pin%22%3A%22135001%22%2C%22city%22%3A%22Yamunanagar%22%2C%22state%22%3A%22Haryana%22%2C%22country%22%3A%22India%22%2C%22phone%22%3A%227206794749%22%2C%22order%22%3A%22CAPTURE-1787978807097%22%2C%22payment_mode%22%3A%22Prepaid%22%2C%22return_pin%22%3A%22110046%22%2C%22return_city%22%3A%22New+Delhi%22%2C%22return_phone%22%3A%229217131801%22%2C%22return_name%22%3A%22MotoXPlus+India+Pvt.+Ltd.%22%2C%22return_add%22%3A%22Khasra+No.+4443%2C+Nasirpur+Village%2C+Palam%2C+New+Delhi+45%2C+near+Dada+Dev+Property%22%2C%22return_state%22%3A%22Delhi%22%2C%22return_country%22%3A%22India%22%2C%22products_desc%22%3A%22Capture+test+item%22%2C%22hsn_code%22%3A%2287141090%22%2C%22cod_amount%22%3A0%2C%22order_date%22%3A%222026-08-29%22%2C%22total_amount%22%3A100%2C%22seller_gst_tin%22%3A%2207AAUCM5765B1Z4%22%2C%22shipping_mode%22%3A%22Surface%22%2C%22address_type%22%3A%22office%22%2C%22quantity%22%3A1%2C%22weight%22%3A0.5%7D%5D%2C%22pickup_location%22%3A%7B%22name%22%3A%22Manish+Giri%22%2C%22add%22%3A%22Khasra+No.+4443%2C+Nasirpur+Village%2C+Palam%2C+New+Delhi+45%2C+near+Dada+Dev+Property%22%2C%22city%22%3A%22New+Delhi%22%2C%22pin_code%22%3A%22110046%22%2C%22country%22%3A%22India%22%2C%22phone%22%3A%229217131801%22%7D%7D
```

RESPONSE: 200 OK
```
{"cash_pickups_count":0.0,"package_count":1,"prepaid_count":1,"pickups_count":0,"replacement_count":0,"cash_pickups":0.0,"cod_amount":0.0,"cod_count":0,"upload_wbn":"UPL10710106414754057777","packages":[{"waybill":"57930810000081","refnum":"CAPTURE-1787978807097","client":"c80988-MOTOXPLUSINDIAPRIVAT-do","payment":"Pre-paid","cod_amount":0.0,"status":"Success","sort_code":"CHA/RAM","serviceable":true,"remarks":[""]}],"success":true}
```

### 4. Track

REQUEST:
```
GET https://track.delhivery.com/api/v1/packages/json/?waybill=57930810000081&verbose=0
Authorization: Token ***REDACTED***
Accept: application/json

```

RESPONSE: 200 OK
```
{
    "ShipmentData": [
        {
            "Shipment": {
                "AWB": "57930810000081",
                "CODAmount": 0,
                "ChargedWeight": null,
                "DeliveryDate": null,
                "DestRecieveDate": null,
                "Destination": "Yamunanagar",
                "DispatchCount": 0,
                "Ewaybill": [],
                "ExpectedDeliveryDate": null,
                "Extras": "",
                "FirstAttemptDate": null,
                "InvoiceAmount": 100,
                "OrderType": "Pre-paid",
                "Origin": "Delhi_Airport_GW (Delhi)",
                "OriginRecieveDate": null,
                "OutDestinationDate": null,
                "PickUpDate": "2026-08-29T10:16:56.763",
                "PickedupDate": null,
                "PickupLocation": "Manish Giri",
                "PromisedDeliveryDate": null,
                "Quantity": "1",
                "RTOStartedDate": null,
                "ReferenceNo": "CAPTURE-1787978807097",
                "ReturnPromisedDeliveryDate": null,
                "ReturnedDate": null,
                "ReverseInTransit": false,
                "SenderName": "c80988-MOTOXPLUSINDIAPRIVAT-do",
                "Status": {
                    "Instructions": "Manifest uploaded",
                    "RecievedBy": "",
                    "Status": "Manifested",
                    "StatusCode": "X-UCI",
                    "StatusDateTime": "2026-08-29T10:16:56.796",
                    "StatusLocation": "Delhi_Airport_GW (Delhi)",
                    "StatusType": "UD"
                }
            }
        }
    ]
}
```

### 5. Cancel

REQUEST:
```
POST https://track.delhivery.com/api/p/edit
Authorization: Token ***REDACTED***
Content-Type: application/json
{"waybill":"57930810000081","cancellation":"true"}
```

RESPONSE: 200 OK
```
<?xml version="1.0" encoding="utf-8"?>
<root><status>True</status><waybill>57930810000081</waybill><order_id>CAPTURE-1787978807097</order_id><remark>Shipment has been cancelled.</remark></root>
```

### 6. Track (post-cancel, attempt 1/3)

REQUEST:
```
GET https://track.delhivery.com/api/v1/packages/json/?waybill=57930810000081&verbose=0
Authorization: Token ***REDACTED***
Accept: application/json

```

RESPONSE: 200 OK
```
{
    "ShipmentData": [
        {
            "Shipment": {
                "AWB": "57930810000081",
                "CODAmount": 0,
                "ChargedWeight": null,
                "DeliveryDate": null,
                "DestRecieveDate": null,
                "Destination": "Yamunanagar",
                "DispatchCount": 0,
                "Ewaybill": [],
                "ExpectedDeliveryDate": null,
                "Extras": "",
                "FirstAttemptDate": null,
                "InvoiceAmount": 100,
                "OrderType": "Pre-paid",
                "Origin": "Delhi_Airport_GW (Delhi)",
                "OriginRecieveDate": null,
                "OutDestinationDate": null,
                "PickUpDate": "2026-08-29T10:16:56.763",
                "PickedupDate": null,
                "PickupLocation": "Manish Giri",
                "PromisedDeliveryDate": null,
                "Quantity": "1",
                "RTOStartedDate": null,
                "ReferenceNo": "CAPTURE-1787978807097",
                "ReturnPromisedDeliveryDate": null,
                "ReturnedDate": null,
                "ReverseInTransit": false,
                "SenderName": "c80988-MOTOXPLUSINDIAPRIVAT-do",
                "Status": {
                    "Instructions": "Shipment not received from client",
                    "RecievedBy": "",
                    "Status": "Not Picked",
                    "StatusCode": "X-PNP",
                    "StatusDateTime": "2026-08-29T10:16:57.435",
                    "StatusLocation": "Delhi_Airport_GW (Delhi)",
                    "StatusType": "UD"
                }
            }
        }
    ]
}
```

### 6. Track (post-cancel, attempt 2/3)

REQUEST:
```
GET https://track.delhivery.com/api/v1/packages/json/?waybill=57930810000081&verbose=0
Authorization: Token ***REDACTED***
Accept: application/json

```

RESPONSE: 200 OK
```
{
    "ShipmentData": [
        {
            "Shipment": {
                "AWB": "57930810000081",
                "CODAmount": 0,
                "ChargedWeight": null,
                "DeliveryDate": null,
                "DestRecieveDate": null,
                "Destination": "Yamunanagar",
                "DispatchCount": 0,
                "Ewaybill": [],
                "ExpectedDeliveryDate": null,
                "Extras": "",
                "FirstAttemptDate": null,
                "InvoiceAmount": 100,
                "OrderType": "Pre-paid",
                "Origin": "Delhi_Airport_GW (Delhi)",
                "OriginRecieveDate": null,
                "OutDestinationDate": null,
                "PickUpDate": "2026-08-29T10:16:56.763",
                "PickedupDate": null,
                "PickupLocation": "Manish Giri",
                "PromisedDeliveryDate": null,
                "Quantity": "1",
                "RTOStartedDate": null,
                "ReferenceNo": "CAPTURE-1787978807097",
                "ReturnPromisedDeliveryDate": null,
                "ReturnedDate": null,
                "ReverseInTransit": false,
                "SenderName": "c80988-MOTOXPLUSINDIAPRIVAT-do",
                "Status": {
                    "Instructions": "Shipment not received from client",
                    "RecievedBy": "",
                    "Status": "Not Picked",
                    "StatusCode": "X-PNP",
                    "StatusDateTime": "2026-08-29T10:16:57.435",
                    "StatusLocation": "Delhi_Airport_GW (Delhi)",
                    "StatusType": "UD"
                }
            }
        }
    ]
}
```

### 6. Track (post-cancel, attempt 3/3)

REQUEST:
```
GET https://track.delhivery.com/api/v1/packages/json/?waybill=57930810000081&verbose=0
Authorization: Token ***REDACTED***
Accept: application/json

```

RESPONSE: 200 OK
```
{
    "ShipmentData": [
        {
            "Shipment": {
                "AWB": "57930810000081",
                "CODAmount": 0,
                "ChargedWeight": null,
                "DeliveryDate": null,
                "DestRecieveDate": null,
                "Destination": "Yamunanagar",
                "DispatchCount": 0,
                "Ewaybill": [],
                "ExpectedDeliveryDate": null,
                "Extras": "",
                "FirstAttemptDate": null,
                "InvoiceAmount": 100,
                "OrderType": "Pre-paid",
                "Origin": "Delhi_Airport_GW (Delhi)",
                "OriginRecieveDate": null,
                "OutDestinationDate": null,
                "PickUpDate": "2026-08-29T10:16:56.763",
                "PickedupDate": null,
                "PickupLocation": "Manish Giri",
                "PromisedDeliveryDate": null,
                "Quantity": "1",
                "RTOStartedDate": null,
                "ReferenceNo": "CAPTURE-1787978807097",
                "ReturnPromisedDeliveryDate": null,
                "ReturnedDate": null,
                "ReverseInTransit": false,
                "SenderName": "c80988-MOTOXPLUSINDIAPRIVAT-do",
                "Status": {
                    "Instructions": "Shipment not received from client",
                    "RecievedBy": "",
                    "Status": "Not Picked",
                    "StatusCode": "X-PNP",
                    "StatusDateTime": "2026-08-29T10:16:57.435",
                    "StatusLocation": "Delhi_Airport_GW (Delhi)",
                    "StatusType": "UD"
                }
            }
        }
    ]
}
```
