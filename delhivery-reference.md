# Delhivery Integration Reference — VERIFIED, do not guess

> **STATUS: NOT YET VERIFIED.** Everything below "Code-derived shapes" was
> extracted from what `src/lib/delhivery/*.ts` currently sends/expects
> (2026-08-23 audit — see `docs/delhivery-audit.md` §3), not from an actual
> captured request/response. Nobody has run a real call and pasted it here.
> Do not treat this section as ground truth for building new code against —
> it's a starting point for `scripts/delhivery-capture.ts` to overwrite with
> real captured pairs. Once real pairs exist, replace the relevant
> code-derived block below with the "Verified calls" entry and delete the
> code-derived version.

## Account
- Client / HQ name (exact):
- Warehouse name (exact, case-sensitive):
- Warehouse pincode:
- Seller GST TIN:
- Environment token works against: [production / staging]

## Verified calls
For each, paste the EXACT request and response.

### Pincode serviceability
REQUEST:
RESPONSE:

### Bulk waybill fetch
REQUEST:
RESPONSE:

### Create order (manifest)
REQUEST (full form body incl. format=json&data=):
RESPONSE:
AWB generated:

### Track
REQUEST:
RESPONSE (full, including the scan array):

### Cancel
REQUEST:
RESPONSE:

## Known-good field values
(any field where the docs were ambiguous and the test settled it)

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