import { b2bRequest } from "./client";

/** Body of POST /client-warehouse/create/ — field names exactly as verified live. */
export interface B2bWarehouseInput {
  name: string;
  pin_code: string;
  city: string;
  state: string;
  country: string;
  address_details: { address: string; contact_person: string; phone_number: string };
  ret_address: { pin: string; address: string };
  pick_up_days: unknown;
  pick_up_hours: unknown;
  business_days: unknown;
  business_hours: unknown;
}

export interface B2bWarehouseResult {
  name: string;
  /** true when Delhivery answered that the warehouse already exists (treated as success). */
  alreadyExisted: boolean;
}

const ALREADY_EXISTS_RE = /already\s+exist/i;

function isSuccessBody(json: unknown): { name: string } | null {
  if (json === null || typeof json !== "object") return null;
  const data = (json as Record<string, unknown>).data;
  if (data === null || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  if (d.success !== true) return null;
  const result = d.result;
  const name = result !== null && typeof result === "object" ? (result as Record<string, unknown>).name : undefined;
  return typeof name === "string" && name.length > 0 ? { name } : null;
}

/**
 * Registers a B2B (ltl-clients) warehouse. Success is `data.success === true`
 * with the created name at `data.result.name`; "already exists" is success.
 * NOTE: for B2B the `address_details` / `ret_address` payload is correct. The
 * B2C warehouse API is a different spec (name / phone / pin / return_address).
 *
 * ⚠️ NOT wired to anything — no route, no startup hook, no script calls this.
 * The production warehouse (DELHIVERY_PICKUP_LOCATION_B2B) was registered once
 * already; do not run this again for it. It exists for registering a *new*
 * warehouse deliberately, by hand.
 */
export async function registerB2bWarehouse(input: B2bWarehouseInput): Promise<B2bWarehouseResult> {
  let json: unknown;
  let text: string;
  try {
    ({ json, text } = await b2bRequest("/client-warehouse/create/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }));
  } catch (err) {
    // A duplicate can come back as an error status. Only that case is success.
    if (err instanceof Error && ALREADY_EXISTS_RE.test(err.message)) {
      return { name: input.name, alreadyExisted: true };
    }
    throw err;
  }

  const ok = isSuccessBody(json);
  if (ok) return { name: ok.name, alreadyExisted: false };
  // ...or as HTTP 200 with data.success !== true and an "already exists" message.
  if (ALREADY_EXISTS_RE.test(text)) return { name: input.name, alreadyExisted: true };

  throw new Error(`Delhivery B2B warehouse registration did not report success: ${text.slice(0, 300)}`);
}
