import { createB2bShipment } from "./shipment";
import { requestB2bPickup } from "./pickup";
import { registerB2bWarehouse } from "./warehouse";
import { nextPickupSlot } from "../pickup";
import type { DelhiveryProvider } from "../provider";

export const b2bProvider: DelhiveryProvider = {
  channel: "B2B",

  async createShipment(orderId) {
    const { jobId, alreadySubmitted } = await createB2bShipment(orderId);
    return { kind: "b2b-manifest", jobId, alreadySubmitted };
  },

  async requestPickup() {
    const slot = nextPickupSlot();
    // TODO(spec): what counts as a "package" for B2B is not specified; one
    // manifest is booked as one package.
    const packageCount = 1;
    await requestB2bPickup({
      pickupDate: slot.pickupDate,
      startTime: slot.pickupTime,
      expectedPackageCount: packageCount,
    });
    return { channel: "B2B", pickupDate: slot.pickupDate, pickupTime: slot.pickupTime, packageCount, pickupId: null };
  },

  registerWarehouse: registerB2bWarehouse,
};
