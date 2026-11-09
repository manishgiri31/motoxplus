import { prisma } from "@/lib/prisma";
import { createDelhiveryShipment } from "../shipment";
import { requestDelhiveryPickup, nextPickupSlot } from "../pickup";
import { bookPickupOncePerDay } from "../pickup-day";
import { getDelhiveryConfig } from "../config";
import { DelhiveryNotSpecifiedError } from "../errors";
import type { DelhiveryProvider } from "../provider";

/**
 * Thin adapter over the existing, live-verified B2C code (shipment.ts,
 * pickup.ts, config.ts — track.delhivery.com, static token). Adds no behaviour.
 */
export const b2cProvider: DelhiveryProvider = {
  channel: "B2C",

  async createShipment(orderId) {
    const { waybill, trackingUrl } = await createDelhiveryShipment(orderId);
    return { kind: "b2c-awb", waybill, trackingUrl };
  },

  // One pickup per warehouse per day (not per order): the first order of the day
  // for a warehouse sends it, later orders for that warehouse find it open. The
  // warehouse is the order's pickupLocationName (a vendor's warehouse), or the
  // configured MotoXPlus location for orders without one.
  async requestPickup(orderId) {
    const now = new Date();
    const slot = nextPickupSlot(now);
    const order = await prisma.order.findUnique({ where: { id: orderId }, select: { pickupLocationName: true } });
    if (!order) throw new Error(`Order ${orderId} not found`);
    const warehouse = order.pickupLocationName || getDelhiveryConfig("B2C").pickup.locationName;
    return bookPickupOncePerDay({
      channel: "B2C",
      warehouse,
      ...slot,
      send: async () => {
        // Counts THIS warehouse's shipments still MANIFESTED (waiting for pickup)
        // and sends that as expected_package_count.
        const r = await requestDelhiveryPickup("B2C", now, warehouse);
        return { packageCount: r.packageCount, pickupId: r.pickupId, alreadyScheduled: r.alreadyScheduled };
      },
    });
  },

  /**
   * TODO(spec): B2C warehouse registration. Its spec is the one with
   * name / phone / pin / return_address (rate limit 10/min) — NOT the
   * address_details / ret_address payload, which is the B2B (ltl-clients) doc.
   * Not provided yet, so nothing is sent.
   */
  async registerWarehouse() {
    throw new DelhiveryNotSpecifiedError(
      "B2C warehouse registration is not implemented: the request spec has not been provided."
    );
  },
};
