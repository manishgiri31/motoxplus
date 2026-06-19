// ─── Serviceability ───────────────────────────────────────────────────────────

export interface DelhiveryPincodeData {
  city: string;
  state: string;
  country: string;
  pin: string;
  express_capable: boolean;
  cod: boolean;
  pickup: boolean;
  prepaid: boolean;
  cod_amount_limit?: number;
  delivery_days?: number;
}

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

export interface DelhiveryCreateShipmentResponse {
  packages: Array<{
    refnum: string;
    status: "Success" | "Error";
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

export interface DelhiveryScan {
  ScanDetail: {
    Scan: string;
    ScanDateTime: string;
    ScanType: string;
    ScannedLocation: string;
    Instructions: string;
    StatusDateTime: string;
  };
}

export interface DelhiveryShipmentData {
  Shipment: {
    AWB: string;
    Destination: string;
    DestinationCity: string;
    ExpectedDeliveryDate: string;
    Origin: string;
    OriginCity: string;
    Consignee: {
      Name: string;
      Address1: string;
      City: string;
      State: string;
      PinCode: string;
    };
    Status: {
      Status: string;
      StatusDateTime: string;
      StatusLocation: string;
      Instructions: string;
      StatusType: string;
    };
    ReferenceNo: string;
    PaymentMode: string;
    TotalAmount: number;
    CODAmount: number;
  };
  Scans: DelhiveryScan[];
}

export interface DelhiveryTrackResponse {
  ShipmentData: DelhiveryShipmentData[];
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
