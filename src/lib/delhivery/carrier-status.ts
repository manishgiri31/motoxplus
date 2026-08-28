/**
 * Pure carrier-status predicates. NO imports, NO network, NO DB — so both the
 * live classifier (carrier-cancellation.ts) and the syncTrackingToDb write-guard
 * (tracking.ts, F-17) can share one definition of "has this parcel left yet?".
 *
 * DECISION-RULES §3: never route a fee/tier decision through Order.status or
 * normalizeShipmentStatus. This module reads the RAW Delhivery Status fields
 * (Status.Status / Status.StatusCode / PickedupDate) captured verbatim in
 * delhivery-reference.md, nothing normalized.
 *
 * Verified pre-pickup captures (delhivery-reference.md, AWB 57930810000066):
 *   - Manifested:      Status="Manifested",  StatusCode="X-UCI",   PickedupDate=null
 *   - Not Picked:      Status="Not Picked",  StatusCode="X-PNP",    PickedupDate=null
 *   - Seller cancel:   Status="Not Picked",  StatusCode="DTUP-210", PickedupDate=null
 * Delhivery's own docs claim a cancelled parcel moves to "Returned" — the live
 * capture proves that is wrong for a pre-pickup cancel (stays "Not Picked").
 */

/**
 * Raw Status.Status strings that mean the parcel is still at origin / not yet
 * collected by the courier. Lower-cased, trimmed. Anything NOT in this set is
 * treated as post-pickup (fail closed — DECISION-RULES §1).
 */
export const PRE_SHIP_CARRIER_STATUS_TEXTS: ReadonlySet<string> = new Set([
  "manifested",
  "manifest uploaded",
  "not picked",
  "not received",
  "shipment not received from client",
  "pending",
  "open",
  "ready to ship",
]);

/**
 * Raw Status.StatusCode prefixes confirmed pre-pickup in live captures.
 * X-UCI = manifest uploaded, X-PNP = pickup not done, DTUP- = upcountry
 * pre-pickup / seller-cancelled-before-pickup.
 */
export const PRE_SHIP_CARRIER_STATUS_CODE_PREFIXES: readonly string[] = ["X-UCI", "X-PNP", "DTUP-"];

export interface RawCarrierStatus {
  statusText: string | null | undefined;
  statusCode: string | null | undefined;
  /** Delhivery's PickedupDate — null until the courier actually collects the parcel. */
  pickedUpDate: string | null | undefined;
}

/**
 * True only when we have positive evidence the parcel has NOT been picked up.
 * Unknown / empty / anything post-pickup → false (fail closed toward "shipped").
 */
export function isPreShipCarrierStatus(raw: RawCarrierStatus): boolean {
  // Any pickup timestamp at all means it has left — overrides the status text.
  if (raw.pickedUpDate) return false;

  const text = (raw.statusText ?? "").trim().toLowerCase();
  const code = (raw.statusCode ?? "").trim().toUpperCase();

  if (text && PRE_SHIP_CARRIER_STATUS_TEXTS.has(text)) return true;
  if (code && PRE_SHIP_CARRIER_STATUS_CODE_PREFIXES.some((p) => code.startsWith(p))) return true;
  return false;
}

/**
 * True when the carrier response carries no usable status signal at all
 * (no Status object, or both text and code blank). Callers treat this as
 * "couldn't determine" rather than guessing a tier.
 */
export function isCarrierStatusUnusable(raw: RawCarrierStatus | null | undefined): boolean {
  if (!raw) return true;
  const text = (raw.statusText ?? "").trim();
  const code = (raw.statusCode ?? "").trim();
  return text === "" && code === "";
}

/**
 * ShipmentStatus enum values (schema.prisma) that mean the parcel is already
 * with the courier or further along — a dealer must not self-cancel these,
 * and no live carrier fetch is needed to know it. MANIFESTED/PENDING are
 * deliberately absent: those still need the live check.
 */
export const POST_PICKUP_SHIPMENT_STATUSES: ReadonlySet<string> = new Set([
  "PICKED_UP",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "FAILED_DELIVERY",
  "RETURNED",
  "CANCELLED",
]);
