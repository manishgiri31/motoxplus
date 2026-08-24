import { delhiveryFetch } from "./client";
import type { DelhiveryPincodeResponse, ServiceabilityResult } from "./types";

export interface PincodeCapability {
  pincode: string;
  serviceable: boolean;
  prepaid: boolean;
  cod: boolean;
  pickup: boolean;
  cashOnPickup: boolean;
  replacement: boolean;
  isOda: boolean;
  city: string;
  district: string;
}

const isYes = (v: string) => v === "Y";

/**
 * Raw pincode capability lookup, typed against the real captured response
 * (delhivery-reference.md, "1. Pincode serviceability"). Returns null for an
 * unserviceable pincode — Delhivery returns an empty `delivery_codes` array,
 * not an error — so callers can tell "not serviceable" apart from "the API
 * call itself failed" (which throws). createShipment() will call this to
 * re-check serviceability before manifesting.
 */
export async function isServiceable(pincode: string): Promise<PincodeCapability | null> {
  const trimmed = pincode.trim();
  if (!/^\d{6}$/.test(trimmed)) {
    throw new Error(`isServiceable: pincode must be exactly 6 digits, got "${pincode}"`);
  }

  const data = await delhiveryFetch<DelhiveryPincodeResponse>(`/c/api/pin-codes/json/?filter_codes=${trimmed}`);

  const entry = data?.delivery_codes?.[0]?.postal_code;
  if (!entry) return null;

  return {
    pincode: trimmed,
    serviceable: isYes(entry.pre_paid) || isYes(entry.cod),
    prepaid: isYes(entry.pre_paid),
    cod: isYes(entry.cod),
    pickup: isYes(entry.pickup),
    cashOnPickup: isYes(entry.cash),
    replacement: isYes(entry.repl),
    isOda: isYes(entry.is_oda),
    city: entry.city,
    district: entry.district,
  };
}

export async function checkServiceability(destinationPincode: string): Promise<ServiceabilityResult> {
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
    const capability = await isServiceable(pincode);

    if (!capability) {
      return {
        serviceable: false,
        estimatedDeliveryDays: null,
        availableServices: [],
        city: null,
        state: null,
        error: "Pincode not found in Delhivery network",
      };
    }

    const services: string[] = [];
    if (capability.prepaid) services.push("Prepaid");
    if (capability.cod) services.push("COD");
    if (capability.pickup) services.push("Pickup");

    return {
      serviceable: capability.serviceable,
      // Delhivery's real response has no delivery-days estimate field at all
      // (the old code read one that never existed) — this is still just a
      // hardcoded placeholder, same as before.
      estimatedDeliveryDays: capability.serviceable ? 3 : null,
      availableServices: services,
      city: capability.city,
      // No full state name in the real response, only state_code (e.g. "HR") —
      // returning null rather than guessing a full name from the code.
      state: null,
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
