import { b2bRequest } from "./client";
import { getB2bConfig } from "./config";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/;

export interface B2bPickupInput {
  /** YYYY-MM-DD */
  pickupDate: string;
  /** HH:MM:SS */
  startTime: string;
  expectedPackageCount: number;
}

/**
 * POST /pickup_requests/ (trailing slash is part of the path) — JSON
 * {client_warehouse, pickup_date, start_time, expected_package_count}.
 * The response shape is not specified, so the parsed body is returned untouched
 * and no "already exists" handling is attempted (no spec for what that looks
 * like) — any non-2xx throws.
 */
export async function requestB2bPickup(input: B2bPickupInput): Promise<unknown> {
  if (!DATE_RE.test(input.pickupDate)) throw new Error(`B2B pickup: pickup_date must be YYYY-MM-DD, got "${input.pickupDate}"`);
  if (!TIME_RE.test(input.startTime)) throw new Error(`B2B pickup: start_time must be HH:MM:SS, got "${input.startTime}"`);
  if (!Number.isInteger(input.expectedPackageCount) || input.expectedPackageCount < 1) {
    throw new Error("B2B pickup: expected_package_count must be a positive integer");
  }

  const { pickupLocationName } = getB2bConfig();
  const { json, text } = await b2bRequest("/pickup_requests/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_warehouse: pickupLocationName, // = DELHIVERY_PICKUP_LOCATION_B2B
      pickup_date: input.pickupDate,
      start_time: input.startTime,
      expected_package_count: input.expectedPackageCount,
    }),
  });
  return json ?? text;
}
