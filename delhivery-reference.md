# Delhivery Integration Reference — VERIFIED, do not guess

> **STATUS: PARTIALLY VERIFIED**, as of the 2026-08-23 live capture run (raw
> pairs below under "CAPTURED"). Pincode serviceability and bulk waybill
> fetch are real, live-verified responses. Create order failed on account
> balance, not payload — see "Create order (manifest)" below — so the
> success shape is still unconfirmed. Track and Cancel haven't been attempted
> yet (no AWB was ever created). Everything under "Code-derived shapes" below
> is still unverified — extracted from what `src/lib/delhivery/*.ts` sends/
> expects, not from a captured call. Don't treat that section as ground truth;
> once a field there is confirmed by a real capture, move it up into
> "Verified calls" and drop it from the code-derived block.

## Account
- Client / HQ name (exact): c80988-MOTOXPLUSINDIAPRIVAT-do
- Warehouse name (exact, case-sensitive): MotoXPlus India Pvt. Ltd.
- Warehouse pincode: 110046
- Seller GST TIN: 07AAUCM5765B1Z4
- Environment token works against: production (base URL track.delhivery.com; confirmed live 2026-08-23 — pincode check and bulk waybill fetch both succeeded, create.json got past field validation and failed only on account balance)

## Verified calls
For each, paste the EXACT request and response.

### Pincode serviceability
CONFIRMED — see "1. Pincode serviceability" under CAPTURED below (2026-08-23).
Real shape differs from the code-derived guess further down this file: the
actual response is `{ delivery_codes: [{ postal_code: {...} }] }`, not a bare
array — `src/lib/delhivery/types.ts`'s `DelhiveryPincodeData` type is wrong
and needs fixing against the real shape.

### Bulk waybill fetch
CONFIRMED — see "2. Bulk waybill fetch" under CAPTURED below (2026-08-23).
Response is a bare JSON string (a single waybill), not an array — e.g.
`"57930810000011"`. Needed `cl=<DELHIVERY_CLIENT_NAME>` as a query param
alongside the Authorization header; without it, untested.

### Create order (manifest)
ATTEMPTED TWICE, NOT SUCCESSFUL — see both "3. Create shipment (REAL)" entries
under CAPTURED below (2026-08-23, two separate timestamps). Both responses
were `success:false`, `packages[0].status:"Fail"`, `packages[0].waybill:""`,
with the identical remarks: `"Crashing while saving package due to exception
'Prepaid client manifest charge API failed due to insufficient balance'."`
This means the request payload itself passed validation both times (name,
address, GST, pickup fields, client name, etc. were all accepted) — the
account has insufficient prepaid balance to actually manifest.

The second attempt was run *after* being told the wallet was topped up, and
got the exact same error. That's a real discrepancy worth checking directly
in the Delhivery partner dashboard before trying again — possibilities:
the top-up hasn't propagated yet, it went to a different balance/wallet than
the one "Prepaid client manifest charge" draws from, or it's on a different
client account than `c80988-MOTOXPLUSINDIAPRIVAT-do`. The success response
shape (a real non-empty `waybill`) is still unconfirmed.

### Track
Not yet attempted — no AWB has ever been successfully created.

### Cancel
Not yet attempted — no AWB has ever been successfully created.

## Known-good field values
- `DELHIVERY_ORIGIN_PINCODE=110046`, `DELHIVERY_PICKUP_*`, `COMPANY_GST`,
  and `DELHIVERY_CLIENT_NAME` (see Account above) are all confirmed accepted
  by the real API as of 2026-08-23 — create.json failed on account balance,
  not on any of these fields.
- Bulk waybill fetch requires `cl` as a query param (client/HQ name); does
  not work with header-auth alone (untested whether it would 401/400 without
  `cl` — wasn't tried, since `cl` was already known to be needed from docs).

---

## Code-derived shapes (NOT live-verified — see status note above)

Source: `src/lib/delhivery/shipment.ts`, `tracking.ts`, `types.ts` as of the
2026-08-23 audit.

### `POST /api/cmu/create.json` — request (one shipment object, wrapped in `{shipments:[...]}`)
```
name, add, pin, city, state, country, phone, order,
payment_mode ("Prepaid" | "COD"),
return_pin, return_city, return_phone, return_name, return_add,
return_state, return_country,
products_desc, hsn_code, cod_amount, order_date, total_amount,
seller_gst_tin,
shipping_mode ("Surface" | "Express" — code always sends "Surface"),
address_type ("home" | "office" — code always sends "office"),
quantity, weight,
waybill?, length?, height?, breadth?   // typed optional, never populated by shipment.ts
```
Body encoding: `format=json&data=<urlencoded JSON of {shipments:[payload]}>`,
`Content-Type: application/x-www-form-urlencoded`.

Known hardcoded/single-value choices in the current code (not necessarily
correct, just what's shipped): `country` always `"India"`; `shipping_mode`
always `"Surface"`; `address_type` always `"office"`; `hsn_code` is only the
**first** order line item's HSN, not per line item; `seller_gst_tin` reads
`NEXT_PUBLIC_COMPANY_GST` (a client-exposed env var reused server-side).

### `POST /api/cmu/create.json` — response
```
packages: [{ refnum, status: "Success"|"Error", waybill, sort_code?, remarks }],
upload_wbn?, success: boolean, total: number, rmk?, error?
```

### `GET /api/v1/packages/json/?waybill=&verbose=0` — response
```
ShipmentData: [{
  Shipment: {
    AWB, Destination, DestinationCity, ExpectedDeliveryDate, Origin, OriginCity,
    Consignee: { Name, Address1, City, State, PinCode },
    Status: { Status, StatusDateTime, StatusLocation, Instructions, StatusType },
    ReferenceNo, PaymentMode, TotalAmount, CODAmount
  },
  Scans: [{ ScanDetail: { Scan, ScanDateTime, ScanType, ScannedLocation, Instructions, StatusDateTime } }]
}]
```

### `GET /c/api/pin-codes/json/?filter_codes=<pin>` — response
```
[{ city, state, country, pin, express_capable, cod, pickup, prepaid, cod_amount_limit?, delivery_days? }]
```

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
