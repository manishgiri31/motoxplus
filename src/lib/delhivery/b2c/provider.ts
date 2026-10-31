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
  // sends it, later orders find it open. orderId is not needed — the pickup is
  // keyed by the warehouse.
  async requestPickup() {
    const now = new Date();
    const slot = nextPickupSlot(now);
    return bookPickupOncePerDay({
      channel: "B2C",
      warehouse: getDelhiveryConfig("B2C").pickup.locationName,
      ...slot,
      send: async () => {
        // Counts this channel's shipments still MANIFESTED (waiting for pickup)
        // and sends that as expected_package_count.
        const r = await requestDelhiveryPickup("B2C", now);
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
