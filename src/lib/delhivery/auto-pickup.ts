import { prisma } from "@/lib/prisma";
import { toDelhiveryChannel } from "./config";
import { isAutoPickupEnabled } from "./pickup";
import { getProvider } from "./provider";

/**
 * Fire-and-forget pickup booking after an order's shipment/manifest was
 * created. Never throws; the outcome goes to OrderEvent so the admin order
 * timeline shows what happened:
 *   PICKUP_REQUESTED    — this order's call sent the day's pickup request
 *   PICKUP_ALREADY_OPEN — that warehouse already has today's pickup; nothing sent
 *   PICKUP_FAILED       — the request failed (the day's claim is released, so
 *                         the next order retries)
 *   PICKUP_AUTO_SKIPPED — DELHIVERY_AUTO_PICKUP=false
 *
 * It is one pickup per warehouse per day, NOT per order — see
 * bookPickupOncePerDay. The channel (and so the Delhivery client and warehouse)
 * comes from the order.
 */
export async function autoRequestPickup(orderId: string): Promise<void> {
  if (!isAutoPickupEnabled()) {
    await recordPickupEvent(orderId, "PICKUP_AUTO_SKIPPED", "DELHIVERY_AUTO_PICKUP=false — book the pickup in the Delhivery dashboard");
    return;
  }

  try {
    const order = await prisma.order.findUnique({ where: { id: orderId }, select: { channel: true } });
    if (!order) throw new Error(`Order ${orderId} not found`);

    const b = await getProvider(toDelhiveryChannel(order.channel)).requestPickup(orderId);
    const where = `[${b.channel}] ${b.warehouse} ${b.pickupDate} ${b.pickupTime}`;

    if (b.alreadyOpen) {
      await recordPickupEvent(
        orderId,
        "PICKUP_ALREADY_OPEN",
        `${where} — today's pickup for this warehouse is already open; no new request sent (${b.packageCount ?? "?"} package(s) on it)`
      );
    } else {
      await recordPickupEvent(
        orderId,
        "PICKUP_REQUESTED",
        `${where} — pickup ${b.pickupId ?? "(no id returned)"} requested, ${b.packageCount} package(s) waiting`
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Delhivery] pickup request failed for order ${orderId}: ${message}`);
    await recordPickupEvent(orderId, "PICKUP_FAILED", message.slice(0, 500));
  }
}

async function recordPickupEvent(orderId: string, type: string, reason: string): Promise<void> {
  try {
    await prisma.orderEvent.create({ data: { orderId, type, reason } });
  } catch (err) {
    console.error(`[Delhivery] could not record ${type} OrderEvent for order ${orderId}:`, err);
  }
}
