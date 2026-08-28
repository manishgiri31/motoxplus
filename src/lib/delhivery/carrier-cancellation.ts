import { fetchTrackingDetail } from "./tracking";
import {
  isPreShipCarrierStatus,
  isCarrierStatusUnusable,
  type RawCarrierStatus,
} from "./carrier-status";

/**
 * Cancellation fee tier as decided from RAW carrier data — never from
 * Order.status or normalizeShipmentStatus (DECISION-RULES §3).
 *
 *   PRE_SHIP     — positive evidence the parcel has not been picked up
 *   POST_SHIP    — the parcel is with the courier or further along
 *   FETCH_FAILED — the carrier call failed / timed out / returned nothing usable
 *
 * Callers fail closed on FETCH_FAILED: the dealer self-serve path blocks and
 * routes to an admin; the admin path defaults the tier selector to POST_SHIP
 * but shows that it could not be determined.
 */
export type CarrierTier = "PRE_SHIP" | "POST_SHIP" | "FETCH_FAILED";

/** Pure — exported for tests and for the admin preview display. */
export function classifyRawCarrierStatus(raw: RawCarrierStatus | null | undefined): CarrierTier {
  if (isCarrierStatusUnusable(raw)) return "FETCH_FAILED";
  return isPreShipCarrierStatus(raw as RawCarrierStatus) ? "PRE_SHIP" : "POST_SHIP";
}

export interface CarrierClassification {
  tier: CarrierTier;
  /** Raw Status.Status, verbatim, for display/logging. Empty string on failure. */
  rawStatusText: string;
  /** Raw Status.StatusCode, verbatim, for display/logging. Empty string on failure. */
  rawStatusCode: string;
}

/**
 * One live Delhivery track call, hard 10s timeout, NO retries, NO DB writes.
 * Cancellation is a rare deliberate action, not a hot path — one blocking
 * fetch here is acceptable (the "no external call in the dealer hot path"
 * constraint was about checkout latency and does not transfer). See the
 * v2/v3 emergency-batch decisions.
 */
export async function classifyCarrierTier(waybill: string): Promise<CarrierClassification> {
  try {
    const detail = await Promise.race([
      fetchTrackingDetail(waybill, { retries: 1 }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("carrier tracking timeout")), 10_000)
      ),
    ]);

    if (!detail || !detail.Status) {
      return { tier: "FETCH_FAILED", rawStatusText: "", rawStatusCode: "" };
    }

    const raw: RawCarrierStatus = {
      statusText: detail.Status.Status,
      statusCode: detail.Status.StatusCode,
      pickedUpDate: detail.PickedupDate,
    };

    return {
      tier: classifyRawCarrierStatus(raw),
      rawStatusText: detail.Status.Status ?? "",
      rawStatusCode: detail.Status.StatusCode ?? "",
    };
  } catch (err) {
    console.error(`[carrier-cancellation] classify failed for ${waybill}:`, err);
    return { tier: "FETCH_FAILED", rawStatusText: "", rawStatusCode: "" };
  }
}
