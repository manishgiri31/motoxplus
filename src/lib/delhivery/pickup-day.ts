import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DelhiveryChannel } from "./config";

/** A PENDING claim older than this is treated as abandoned (the claimer crashed) and may be retaken. */
export const PICKUP_CLAIM_STALE_MS = 2 * 60 * 1000;

export interface PickupBooking {
  channel: DelhiveryChannel;
  warehouse: string;
  pickupDate: string;
  pickupTime: string;
  /**
   * true when a pickup for this warehouse/day was already open, so NO new
   * request was sent (or Delhivery itself said one already exists).
   */
  alreadyOpen: boolean;
  /** Waiting packages the request was sent with; for an already-open day, what the first request recorded. */
  packageCount: number | null;
  pickupId: string | null;
}

export interface PickupSendResult {
  packageCount: number;
  pickupId: string | null;
  /** The carrier said a request for this slot already exists (treated as open, not as a failure). */
  alreadyScheduled?: boolean;
}

/**
 * ONE pickup request per channel + warehouse + pickup day — not per order.
 *
 * The state lives in PickupRequest (unique on channel+warehouse+pickupDate),
 * because no Delhivery "list open pickups" call is specified. The unique key is
 * also the lock, so two orders arriving together cannot both send:
 *   1. claim: insert a PENDING row. The first order wins; everyone else gets a
 *      unique-constraint hit and returns `alreadyOpen` without calling Delhivery.
 *   2. the winner runs `send` (which must count that warehouse's WAITING
 *      packages and send them as expected_package_count) and marks the row
 *      REQUESTED.
 *   3. if `send` fails the claim is released, so the next order retries instead
 *      of the whole day being left without a pickup.
 * A crash between 1 and 2 leaves a PENDING row; after PICKUP_CLAIM_STALE_MS the
 * next order takes it over.
 *
 * Known limit: the count is fixed when the request is sent. Orders that arrive
 * later the same day are not added to it — there is no spec'd call to amend a
 * pickup request.
 */
export async function bookPickupOncePerDay(params: {
  channel: DelhiveryChannel;
  warehouse: string;
  pickupDate: string;
  pickupTime: string;
  send: () => Promise<PickupSendResult>;
}): Promise<PickupBooking> {
  const { channel, warehouse, pickupDate, pickupTime, send } = params;
  const base = { channel, warehouse, pickupDate, pickupTime };
  const key = { channel, warehouse, pickupDate };

  let claimId: string;
  try {
    claimId = (await prisma.pickupRequest.create({ data: { ...key, pickupTime } })).id;
  } catch (err) {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) throw err;

    const existing = await prisma.pickupRequest.findUnique({ where: { channel_warehouse_pickupDate: key } });
    const open: PickupBooking = {
      ...base,
      alreadyOpen: true,
      packageCount: existing?.packageCount ?? null,
      pickupId: existing?.pickupId ?? null,
    };
    if (!existing || existing.status === "REQUESTED") return open;

    // PENDING: another order is sending right now — unless that claim is abandoned.
    const staleBefore = new Date(Date.now() - PICKUP_CLAIM_STALE_MS);
    const taken = await prisma.pickupRequest.updateMany({
      where: { id: existing.id, status: "PENDING", updatedAt: { lt: staleBefore } },
      data: { pickupTime },
    });
    if (taken.count === 0) return open;
    claimId = existing.id;
  }

  try {
    const sent = await send();
    await prisma.pickupRequest.update({
      where: { id: claimId },
      data: { status: "REQUESTED", packageCount: sent.packageCount, pickupId: sent.pickupId },
    });
    return {
      ...base,
      alreadyOpen: sent.alreadyScheduled === true,
      packageCount: sent.packageCount,
      pickupId: sent.pickupId,
    };
  } catch (err) {
    // Release only our own still-PENDING claim so the next order can retry.
    await prisma.pickupRequest.deleteMany({ where: { id: claimId, status: "PENDING" } }).catch(() => undefined);
    throw err;
  }
}
