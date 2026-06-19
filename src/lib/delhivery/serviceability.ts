import { delhiveryFetch } from "./client";
import type { DelhiveryPincodeData, ServiceabilityResult } from "./types";

export async function checkServiceability(
  destinationPincode: string
): Promise<ServiceabilityResult> {
  const pincode = destinationPincode.trim();

  if (!/^\d{6}$/.test(pincode)) {
    return {
      serviceable: false,
      estimatedDeliveryDays: null,
      availableServices: [],
      city: null,
      state: null,
      error: "Invalid pincode format",
    };
  }

  try {
    const data = await delhiveryFetch<DelhiveryPincodeData[]>(
      `/c/api/pin-codes/json/?filter_codes=${pincode}`
    );

    if (!data || data.length === 0) {
      return {
        serviceable: false,
        estimatedDeliveryDays: null,
        availableServices: [],
        city: null,
        state: null,
        error: "Pincode not found in Delhivery network",
      };
    }

    const pin = data[0];
    const services: string[] = [];

    if (pin.express_capable) services.push("Express");
    if (pin.prepaid) services.push("Prepaid");
    if (pin.cod) services.push("COD");
    if (pin.pickup) services.push("Pickup");

    const isServiceable = pin.express_capable || pin.prepaid;

    return {
      serviceable: isServiceable,
      estimatedDeliveryDays: pin.delivery_days ?? (isServiceable ? 3 : null),
      availableServices: services,
      city: pin.city,
      state: pin.state,
    };
  } catch (err) {
    console.error("[Delhivery] serviceability check failed:", err);
    return {
      serviceable: false,
      estimatedDeliveryDays: null,
      availableServices: [],
      city: null,
      state: null,
      error: "Unable to check serviceability. Please try again.",
    };
  }
}
