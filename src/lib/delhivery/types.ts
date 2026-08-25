// ─── Serviceability ───────────────────────────────────────────────────────────
// Shape below is transcribed exactly from a live-captured response
// (delhivery-reference.md, "1. Pincode serviceability", 2026-08-23) — the
// real response is `{ delivery_codes: [{ postal_code: {...} }] }`, not a
// bare array, and several previously-assumed fields (express_capable,
// delivery_days, a full "state" name, cod_amount_limit) don't exist at all.

export interface DelhiveryPostalCodeCenter {
  code: string;
  cn: string;
  sort_code: string;
  s: string;
  e: string;
  u: string;
  ud: string;
}

export interface DelhiveryPostalCode {
  remarks: string;
  pin: number;
  country_code: string;
  state_code: string;
  cod: "Y" | "N";
  pre_paid: "Y" | "N";
  pickup: "Y" | "N";
  cash: "Y" | "N";
  repl: "Y" | "N";
  district: string;
  is_oda: "Y" | "N";
  sort_code: string;
  max_amount: number;
  max_weight: number;
  covid_zone: string;
  inc: string;
  center: DelhiveryPostalCodeCenter[];
  city: string;
  sun_tat: boolean;
  protect_blacklist: boolean;
  srv_wt_th: number;
}

export interface DelhiveryPincodeResponse {
  delivery_codes: Array<{ postal_code: DelhiveryPostalCode }>;
}

// Bare JSON string, e.g. "57930810000011" — confirmed via live capture
// (delhivery-reference.md, "2. Bulk waybill fetch", 2026-08-23) for
// count=1. Behavior for count>1 is unconfirmed; do not assume an array or
// an object with a `.waybill` field until that's captured too.
export type DelhiveryBulkWaybillResponse = string;

export interface ServiceabilityResult {
  serviceable: boolean;
  estimatedDeliveryDays: number | null;
  availableServices: string[];
  city: string | null;
  state: string | null;
  error?: string;
}

// ─── Rate Calculation ─────────────────────────────────────────────────────────

export interface RateInput {
  originPincode: string;
  destinationPincode: string;
  weightKg: number;
  paymentMode: "Prepaid" | "COD";
  codAmount?: number;
}

export interface RateResult {
  shippingCost: number;
  source: "delhivery_api" | "rate_slab" | "default";
  breakdown?: {
    freight: number;
    codCharges?: number;
    fuelSurcharge?: number;
  };
}

export interface DelhiveryRateResponse {
  total_amount: number;
  freight_charge: number;
  cod_charges: number;
  fuel_surcharge: number;
  status: string;
}

// ─── Shipment Creation ────────────────────────────────────────────────────────

export interface DelhiveryShipmentPayload {
  name: string;
  add: string;
  pin: string;
  city: string;
  state: string;
  country: string;
  phone: string;
  order: string;
  payment_mode: "Prepaid" | "COD";
  return_pin: string;
  return_city: string;
  return_phone: string;
  return_name: string;
  return_add: string;
  return_state: string;
  return_country: string;
  products_desc: string;
  hsn_code: string;
  cod_amount: number;
  order_date: string;
  total_amount: number;
  seller_gst_tin: string;
  shipping_mode: "Surface" | "Express";
  address_type: "home" | "office";
  quantity: number;
  weight: number;
  waybill?: string;
  length?: number;
  height?: number;
  breadth?: number;
}

// Sibling of `shipments` in the create.json request body, not a field inside
// the shipment object — this was missing entirely before the 2026-08-23 live
// capture exposed it. `pin_code` (not `pin`) is per Delhivery's docs, not a
// capture — untested; first thing to try changing if this key errors.
export interface DelhiveryPickupLocation {
  name: string;
  add: string;
  city: string;
  pin_code: string;
  country: string;
  phone: string;
}

export interface DelhiveryCreateShipmentRequest {
  shipments: DelhiveryShipmentPayload[];
  pickup_location: DelhiveryPickupLocation;
}

export interface DelhiveryCreateShipmentResponse {
  packages: Array<{
    refnum: string;
    // "Fail", not "Error" — confirmed via live capture (delhivery-reference.md,
    // "3. Create shipment", 2026-08-23); the old "Error" value here was
    // code-derived guesswork and never actually seen from the API.
    status: "Success" | "Fail";
    waybill: string;
    sort_code?: string;
    remarks: string;
  }>;
  upload_wbn?: string;
  success: boolean;
  total: number;
  rmk?: string;
  error?: string;
}

// ─── Tracking ─────────────────────────────────────────────────────────────────
// Shape below is transcribed exactly from a live capture of AWB
// 57930810000066 at verbose=2 (delhivery-reference.md, "11. Track verbose=2",
// 2026-08-24). Production always requests verbose=2 — verbose 0/1/2 are
// confirmed strict supersets of each other, so there's no cost, and
// Consignee lets us verify the destination without joining back to our own
// order record (src/lib/delhivery/tracking.ts sets this explicitly). This
// type therefore models exactly that one response, not a hypothetical union
// across verbosity levels.

export interface DelhiveryScanDetail {
  Instructions: string;
  Scan: string;
  ScanDateTime: string;
  ScanType: string;
  ScannedLocation: string;
  // Confirmed present inside ScanDetail by the live capture — the old
  // code-derived type didn't have it here.
  StatusCode: string;
  StatusDateTime: string;
}

export interface DelhiveryScan {
  ScanDetail: DelhiveryScanDetail;
}

export interface DelhiveryConsignee {
  // Empty-array case is capture-observed. The populated case is UNVERIFIED —
  // this shipment's create.json payload DID contain a real street address
  // ("House No. 123, Model Town Road") and Address1/Address2 still came back
  // as `[]`, so this may be a field Delhivery never echoes back at all,
  // rather than one that's merely conditionally empty. Do not normalize `[]`
  // to `""` in the parser — keep the wire shape honest, let call sites
  // handle it. TODO: confirm the populated shape from the first real
  // customer shipment.
  Address1: string | [];
  Address2: string | [];
  Address3: string;
  City: string;
  Country: string;
  Name: string;
  // Number, not string — 135001, not "135001". Same numeric-pincode quirk
  // seen in the serviceability endpoint.
  PinCode: number;
  State: string;
  Telephone1: string;
  Telephone2: string;
}

export interface DelhiveryShipmentStatus {
  Instructions: string;
  RecievedBy: string;
  Status: string;
  StatusCode: string;
  StatusDateTime: string;
  StatusLocation: string;
  StatusType: string;
}

export interface DelhiveryShipment {
  AWB: string;
  CODAmount: number;
  ChargedWeight: number | null;
  Consignee: DelhiveryConsignee;
  DeliveryDate: string | null;
  DestRecieveDate: string | null;
  Destination: string;
  DispatchCount: number;
  // Only ever observed empty. This order's value (₹100) was well under
  // Delhivery's ₹50,000 e-waybill threshold, which plausibly explains why —
  // but the populated shape is unverified, so this stays an empty tuple
  // rather than a guessed-at `string[]`.
  Ewaybill: [];
  ExpectedDeliveryDate: string | null;
  Extras: string;
  FirstAttemptDate: string | null;
  InvoiceAmount: number;
  // Only "Pre-paid" has been observed — this integration's only real
  // create.json call so far used payment_mode "Prepaid" (matches
  // packages[0].payment from the create response). A real COD shipment
  // capture is needed before adding another literal to this union.
  OrderType: "Pre-paid";
  Origin: string;
  OriginRecieveDate: string | null;
  OutDestinationDate: string | null;
  // Populated immediately at manifest creation in every capture, before
  // actual pickup occurred — nullability before that point is unconfirmed.
  PickUpDate: string;
  PickedupDate: string | null;
  PickupLocation: string;
  PromisedDeliveryDate: string | null;
  // String, not number — "1", not 1. Modeled as captured.
  Quantity: string;
  RTOStartedDate: string | null;
  ReferenceNo: string;
  ReturnPromisedDeliveryDate: string | null;
  ReturnedDate: string | null;
  ReverseInTransit: boolean;
  Scans: DelhiveryScan[];
  SenderName: string;
  Status: DelhiveryShipmentStatus;
}

export interface DelhiveryShipmentData {
  Shipment: DelhiveryShipment;
}

export interface DelhiveryTrackResponse {
  ShipmentData: DelhiveryShipmentData[];
}

// Delhivery's response for a waybill it has no record of — confirmed via a
// live capture on a nonexistent AWB (delhivery-reference.md, "12. Track,
// nonexistent AWB", 2026-08-25). HTTP 200, not 404 — this shape, not the
// status code, is the only way to detect it.
export interface DelhiveryTrackNotFoundResponse {
  Success: false;
  Error: string;
  rmk: string;
}

export interface TrackingEvent {
  status: string;
  location: string;
  activity: string;
  timestamp: string;
}

export interface TrackingResult {
  waybill: string;
  status: string;
  currentLocation: string;
  estimatedDelivery: string | null;
  events: TrackingEvent[];
  error?: string;
}

// ─── Webhook ──────────────────────────────────────────────────────────────────

export interface DelhiveryWebhookPayload {
  waybill: string;
  status?: string;
  "package-status"?: string;
  remarks?: string;
  location?: string;
  "current-location"?: string;
  "updated-at"?: string;
  updated_at?: string;
  "expected-date"?: string;
  expected_date?: string;
  client?: string;
  [key: string]: unknown;
}

// ─── Delhivery Status Map ─────────────────────────────────────────────────────

export const DELHIVERY_STATUS_MAP: Record<string, string> = {
  "manifested": "MANIFESTED",
  "in transit": "IN_TRANSIT",
  "intransit": "IN_TRANSIT",
  "picked up": "PICKED_UP",
  "pickup": "PICKED_UP",
  "out for delivery": "OUT_FOR_DELIVERY",
  "delivered": "DELIVERED",
  "delivery failed": "FAILED_DELIVERY",
  "undelivered": "FAILED_DELIVERY",
  "rto initiated": "RETURNED",
  "rto delivered": "RETURNED",
  "return": "RETURNED",
  "cancelled": "CANCELLED",
};

export function normalizeShipmentStatus(raw: string): string {
  const lower = raw.toLowerCase().trim();
  for (const [key, val] of Object.entries(DELHIVERY_STATUS_MAP)) {
    if (lower.includes(key)) return val;
  }
  return "IN_TRANSIT";
}
