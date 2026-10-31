import { delhiveryFetch } from "./client";
import { getDelhiveryConfig, type DelhiveryChannel } from "./config";
import { prisma } from "@/lib/prisma";

/**
 * create.json only MANIFESTS a shipment (gives it an AWB). It does not tell a
 * Delhivery executive to come to the warehouse — that is a separate Pickup
 * Request (POST /fm/request/new/). Without it the parcel sits in "Manifested"
 * until someone books the pickup by hand in the Delhivery dashboard.
 *
 * Default ON; skipped only when DELHIVERY_AUTO_PICKUP is explicitly "false".
 */
export function isAutoPickupEnabled(): boolean {
  return (process.env.DELHIVERY_AUTO_PICKUP ?? "true").trim().toLowerCase() !== "false";
}

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const PICKUP_TIME_RE = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
// Pickup requests for a slot that is about to start are rejected — book for the
// next day once we are within this many minutes of (or past) the slot.
const SLOT_CUTOFF_MINUTES = 30;

/** Slot time (IST, HH:MM or HH:MM:SS in the env; HH:MM:SS out). Default sits inside Delhivery's 14:00–18:00 window. */
function pickupTime(): string {
  const configured = process.env.DELHIVERY_PICKUP_TIME?.trim();
  if (!configured || !PICKUP_TIME_RE.test(configured)) return "16:00:00";
  // HH:MM (e.g. DELHIVERY_PICKUP_TIME=16:00) -> HH:MM:SS, the format both pickup APIs take.
  return configured.length === 5 ? `${configured}:00` : configured;
}

/**
 * The next bookable pickup slot, in IST: today's slot if it is still more than
 * SLOT_CUTOFF_MINUTES away, otherwise the same time tomorrow. Pure, so it can
 * be tested with a fixed `now`.
 */
export function nextPickupSlot(now: Date = new Date()): { pickupDate: string; pickupTime: string } {
  const time = pickupTime();
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  const [h, m] = time.split(":").map(Number);
  const nowMinutes = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  const dayOffset = nowMinutes >= h * 60 + m - SLOT_CUTOFF_MINUTES ? 1 : 0;
  const target = new Date(ist.getTime() + dayOffset * 24 * 60 * 60 * 1000);
  return { pickupDate: target.toISOString().split("T")[0], pickupTime: time };
}

/**
 * The instant after which an order belongs to the pickup slot on `pickupDate`:
 * the PREVIOUS day's slot cutoff (slot time minus SLOT_CUTOFF_MINUTES, IST).
 * Orders that arrive after a day's cutoff roll to the next day's slot (see
 * nextPickupSlot), so this is the lower bound of "orders waiting for that slot".
 */
export function previousSlotCutoff(pickupDate: string, time: string): Date {
  const [y, mo, d] = pickupDate.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const istMs = Date.UTC(y, mo - 1, d - 1, h, mi) - SLOT_CUTOFF_MINUTES * 60 * 1000;
  return new Date(istMs - IST_OFFSET_MS);
}

export interface PickupResult {
  pickupId: string | null;
  pickupDate: string;
  pickupTime: string;
  packageCount: number;
  channel: DelhiveryChannel;
  /** true when Delhivery said a request for this slot already exists. */
  alreadyScheduled: boolean;
}

interface DelhiveryPickupResponse {
  pickup_id?: number | string;
  [key: string]: unknown;
}

/**
 * Requests a Delhivery pickup at the registered pickup location for the next
 * slot, using the given channel's token and registered pickup location (B2C
 * and B2B are separate Delhivery clients, so each gets its own request).
 * expected_package_count is the number of that channel's shipments still
 * waiting for pickup (MANIFESTED) — Delhivery keeps one request per
 * location/slot, so each new order folds into the same request instead of
 * leaving the count at 1.
 *
 * Throws on failure; callers (the channel provider / auto-pickup.ts) decide how to surface that.
 */
export async function requestDelhiveryPickup(
  channel: DelhiveryChannel,
  now: Date = new Date()
): Promise<PickupResult> {
  const { pickup } = getDelhiveryConfig(channel);
  const slot = nextPickupSlot(now);

  const waiting = await prisma.shipment.count({ where: { status: "MANIFESTED", order: { channel } } });
  const packageCount = Math.max(1, waiting);

  try {
    const response = await delhiveryFetch<DelhiveryPickupResponse>("/fm/request/new/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pickup_time: slot.pickupTime,
        pickup_date: slot.pickupDate,
        pickup_location: pickup.locationName,
        expected_package_count: packageCount,
      }),
      // A pickup request is not a money/AWB-minting call, but a blind repeat
      // would only hit the "already exists" path — one attempt is enough.
      retries: 1,
      channel,
    });

    return {
      pickupId: response.pickup_id !== undefined ? String(response.pickup_id) : null,
      ...slot,
      channel,
      packageCount,
      alreadyScheduled: false,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Delhivery rejects a second request for a slot that already has one. For
    // our purposes that is success: a pickup IS scheduled.
    if (/already/i.test(message)) {
      return { pickupId: null, ...slot, channel, packageCount, alreadyScheduled: true };
    }
    throw err;
  }
}
