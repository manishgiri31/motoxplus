import { b2bRequest } from "./client";
import { DelhiveryNotSpecifiedError } from "../errors";

/**
 * Transport-level input for POST /manifest. Only field NAMES and the
 * cod_amount rule come from the spec we hold; the inner structure of
 * dropoff_location / invoices / shipment_details is NOT specified, so those
 * are passed through as-is (JSON-stringified) and never interpreted here.
 */
export interface B2bManifestInput {
  pickupLocationName: string;
  paymentMode: "cod" | "prepaid";
  /** Required (> 0) when paymentMode is "cod"; not sent for "prepaid". */
  codAmount?: number;
  /** Grams. */
  weightGrams: number;
  dropoffLocation: unknown;
  invoices: unknown[];
  shipmentDetails: unknown[];
  freightMode: string | number | boolean;
  fmPickup: string | number | boolean;
  rovInsurance: string | number | boolean;
}

/**
 * POST /manifest — multipart/form-data, Bearer JWT. Response carries `job_id`;
 * the manifest is processed asynchronously, so there is no LR number here.
 */
export async function submitB2bManifest(input: B2bManifestInput): Promise<{ jobId: string }> {
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
  form.append("freight_mode", String(input.freightMode));
  form.append("fm_pickup", String(input.fmPickup));
  form.append("rov_insurance", String(input.rovInsurance));

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
