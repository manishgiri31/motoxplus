import { b2bRequest } from "./client";
import { getB2bConfig } from "./config";
import { DelhiveryB2bProdManifestBlockedError, DelhiveryNotSpecifiedError } from "../errors";

// Structures below are the exact shapes from the B2B docs' curl example.

export interface B2bDropoffLocation {
  consignee_name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  email: string;
}

export interface B2bInvoice {
  ewaybill: string;
  inv_num: string;
  inv_amt: number;
  inv_qr_code: string;
}

export interface B2bShipmentDetail {
  order_id: string;
  box_count: number;
  description: string;
  /** Grams. */
  weight: number;
  waybills: string[];
  master: boolean;
}

export interface B2bManifestInput {
  pickupLocationName: string;
  paymentMode: "cod" | "prepaid";
  /** Required (> 0) when paymentMode is "cod"; not sent for "prepaid". */
  codAmount?: number;
  /** Grams. */
  weightGrams: number;
  dropoffLocation: B2bDropoffLocation;
  invoices: B2bInvoice[];
  shipmentDetails: B2bShipmentDetail[];
  freightMode: string;
  fmPickup: boolean;
  /** Sent only when defined — i.e. only for retail / co-loader accounts. */
  rovInsurance?: string;
}

/**
 * POST /manifest — multipart/form-data, Bearer JWT. Response carries `job_id`
 * (its format is not verified, so number or string is accepted); the manifest
 * is processed asynchronously, so there is no LR number here.
 *
 * On the PRODUCTION host this refuses to run until
 * DELHIVERY_B2B_PROD_MANIFEST_VERIFIED=true, i.e. until someone has seen a
 * job_id come back from the dev host. Dev hosts are never gated.
 */
export async function submitB2bManifest(input: B2bManifestInput): Promise<{ jobId: string }> {
  const { isProd, prodManifestVerified } = getB2bConfig();
  if (isProd && !prodManifestVerified) throw new DelhiveryB2bProdManifestBlockedError();

  if (!(input.weightGrams > 0)) throw new Error("B2B manifest: weight (grams) must be > 0");
  if (input.paymentMode === "cod" && !(input.codAmount !== undefined && input.codAmount > 0)) {
    throw new Error("B2B manifest: cod_amount is required (> 0) when payment_mode is cod");
  }

  const form = new FormData();
  form.append("pickup_location_name", input.pickupLocationName);
  form.append("payment_mode", input.paymentMode);
  if (input.paymentMode === "cod") form.append("cod_amount", String(input.codAmount));
  form.append("weight", String(Math.round(input.weightGrams)));
  form.append("dropoff_location", JSON.stringify(input.dropoffLocation));
  form.append("invoices", JSON.stringify(input.invoices));
  form.append("shipment_details", JSON.stringify(input.shipmentDetails));
  form.append("freight_mode", input.freightMode);
  form.append("fm_pickup", String(input.fmPickup));
  if (input.rovInsurance !== undefined) form.append("rov_insurance", input.rovInsurance);

  // No Content-Type header: fetch sets multipart/form-data with the boundary.
  const { json, text } = await b2bRequest("/manifest", { method: "POST", body: form });

  const jobId = json !== null && typeof json === "object" ? (json as Record<string, unknown>).job_id : undefined;
  if ((typeof jobId !== "string" && typeof jobId !== "number") || String(jobId).length === 0) {
    const keys = json !== null && typeof json === "object" ? Object.keys(json).join(", ") || "(empty object)" : "(not a JSON object)";
    throw new DelhiveryNotSpecifiedError(
      `Unexpected Delhivery B2B manifest response: no job_id. Response keys: ${keys}. Body (truncated): ${text.slice(0, 200)}`
    );
  }
  return { jobId: String(jobId) };
}
