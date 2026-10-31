import { createDelhiveryShipment } from "../shipment";
import { requestDelhiveryPickup } from "../pickup";
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

  // The B2C pickup request is per location/slot, not per order, so orderId is
  // not needed to book it.
  async requestPickup() {
    const r = await requestDelhiveryPickup("B2C");
    return {
      channel: "B2C",
      pickupDate: r.pickupDate,
      pickupTime: r.pickupTime,
      packageCount: r.packageCount,
      pickupId: r.pickupId,
    };
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
