import { createB2bShipment, getB2bWaitingPackages } from "./shipment";
import { getB2bConfig } from "./config";
import { bookPickupOncePerDay } from "../pickup-day";
import { requestB2bPickup } from "./pickup";
import { registerB2bWarehouse, type B2bWarehouseInput } from "./warehouse";
import { nextPickupSlot, previousSlotCutoff } from "../pickup";
import type { DelhiveryProvider } from "../provider";

export const b2bProvider: DelhiveryProvider = {
  channel: "B2B",

  async createShipment(orderId) {
    const { jobId, alreadySubmitted } = await createB2bShipment(orderId);
    return { kind: "b2b-manifest", jobId, alreadySubmitted };
  },

  // One pickup per warehouse per day (not per order). orderId is not needed.
  async requestPickup() {
    const slot = nextPickupSlot();
    return bookPickupOncePerDay({
      channel: "B2B",
      warehouse: getB2bConfig().pickupLocationName,
      ...slot,
      send: async () => {
        // expected_package_count = this warehouse's waiting packages: the sum of
        // box_count over manifests accepted for this slot.
        const packageCount = await getB2bWaitingPackages(previousSlotCutoff(slot.pickupDate, slot.pickupTime));
        await requestB2bPickup({ pickupDate: slot.pickupDate, startTime: slot.pickupTime, expectedPackageCount: packageCount });
        return { packageCount, pickupId: null };
      },
    });
  },

  async registerWarehouse(input) {
    if (input === undefined || input === null) {
      throw new Error("B2B registerWarehouse requires the warehouse payload (B2bWarehouseInput)");
    }
    return registerB2bWarehouse(input as B2bWarehouseInput);
  },
};
