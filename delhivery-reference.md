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
- `pickup_location.city: "New Delhi"` (matching `return_city`) was accepted
  without any warehouse/ClientWarehouse resolution error on a real successful
  create.json call — the "try 'Delhi' instead" fallback was not needed.
  Delhivery's own dashboard record for this facility shows city as "Delhi";
  both values coexist without conflict because `name` is the actual match key.
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
CONFIRMED — see "4. Track" (post-create) and "6. Track (post-cancel...)"
entries below. **The real shape is substantially different from what
`src/lib/delhivery/types.ts`'s `DelhiveryShipmentData` currently assumes —
not yet fixed, flagging only:**
- No `Consignee` object at all.
- No `TotalAmount`, `PaymentMode`, `DestinationCity`, `OriginCity` — instead:
  `InvoiceAmount`, `OrderType` (e.g. `"Pre-paid"`), `Destination`, `Origin`.
- **No `Scans` array with `verbose=0`** — `tracking.ts` already defensively
  handles a missing `Scans` via `(Scans || [])` so it doesn't crash, but it
  means with `verbose=0` no scan/event history is ever populated today.
  Unconfirmed whether `verbose=1` returns `Scans`.
- Real fields actually present on `Shipment`: `AWB, CODAmount, ChargedWeight,
  DeliveryDate, DestRecieveDate, Destination, DispatchCount, Ewaybill,
  ExpectedDeliveryDate, Extras, FirstAttemptDate, InvoiceAmount, OrderType,
  Origin, OriginRecieveDate, OutDestinationDate, PickUpDate, PickedupDate,
  PickupLocation, PromisedDeliveryDate, Quantity, RTOStartedDate,
  ReferenceNo, ReturnPromisedDeliveryDate, ReturnedDate, ReverseInTransit,
  SenderName, Status:{Instructions, RecievedBy, Status, StatusCode,
  StatusDateTime, StatusLocation, StatusType}`.

### Cancel
CONFIRMED, with a real surprise — see "5. Cancel" and "7. Cancel again"
entries below (full cycle on AWB `57930810000066`).
- `POST /api/p/edit` with JSON body `{"waybill":"<awb>","cancellation":"true"}`
  is correct — confirmed twice (a fresh cancel and a repeat cancel on an
  already-cancelled AWB).
- **The response is XML, not JSON**: `<?xml version="1.0" encoding="utf-8"?>
  <root><status>True</status><waybill>...</waybill><order_id>...</order_id>
  <remark>Shipment has been cancelled.</remark></root>`. Code that calls this
  must not `JSON.parse()` the response.
- Calling cancel a **second time** on an already-cancelled AWB returns the
  **identical** success response — same HTTP 200, same XML body, same
  `"Shipment has been cancelled."` remark. There is no distinguishable
  "already cancelled" error from the cancel call itself; code that needs to
  know fresh-vs-repeat has to track that locally, not infer it from this response.
- **Contradicts Delhivery's own Cancel Order API docs**: those describe
  Prepaid/COD packages moving to status `"Returned"` on cancellation. For a
  shipment cancelled *before pickup*, `Status.Status` stayed `"Not Picked"`
  throughout and never became "Returned" or "Cancelled". The real signal
  that cancellation took effect was in `Status.Instructions`
  (`"Seller cancelled the order"`) and `Status.StatusCode` (`"DTUP-210"`) —
  and that detail took roughly a minute+ to appear; an immediate re-track
  still showed the generic `"Shipment not received from client"` / `"X-PNP"`.
  Code that needs to confirm cancellation should poll with a delay, not check
  once immediately (the capture script now retries 3x with increasing delay
  for this reason, added 2026-08-25).

## Known-good field values
- `DELHIVERY_ORIGIN_PINCODE=110046`, `DELHIVERY_PICKUP_*`, `COMPANY_GST`,
  and `DELHIVERY_CLIENT_NAME` (see Account above) are all confirmed accepted
  by the real API.
- `pickup_location.name` **must be exactly `"Manish Giri"`** (immutable;
  `DELHIVERY_PICKUP_LOCATION_NAME` env var) — distinct from `return_name` /
  `DELHIVERY_PICKUP_NAME` (`"MotoXPlus India Pvt. Ltd."`). Confusing these
  two is what caused the missing-pickup_location bug in the first place.
- `pickup_location.city: "New Delhi"` is accepted; no need for the "Delhi"
  fallback that was considered before this was tested.
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
