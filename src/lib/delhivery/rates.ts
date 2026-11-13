import { delhiveryFetch } from "./client";
import { prisma } from "@/lib/prisma";
import type { DelhiveryRateResponse, RateInput, RateResult } from "./types";

export async function calculateShippingRate(input: RateInput): Promise<RateResult> {
  // 1. Try Delhivery live rate API
  try {
    const result = await fetchDelhiveryRate(input);
    if (result) return result;
  } catch {
    // fall through to slab calculation
  }

  // 2. Fall back to DB rate slabs
  try {
    const result = await calculateFromSlabs(input);
    if (result) return result;
  } catch {
    // fall through to default
  }

  // 3. Nothing could price this shipment. Callers treat source "default" as
  // "unavailable" and never charge the amount, so no fake flat rate is shown.
  return { shippingCost: 0, source: "default" };
}

async function fetchDelhiveryRate(input: RateInput): Promise<RateResult | null> {
  // Verified against the live account: Surface mode, grams, origin/destination pins.
  // total_amount is the GST-inclusive charge for the shipment.
  const weightGrams = Math.round(input.weightKg * 1000);

  const params = new URLSearchParams({
    md: "S", // Surface
    ss: "Delivered",
    o_pin: input.originPincode, // the pickup warehouse's pin, never a global default
    d_pin: input.destinationPincode,
    cgm: String(weightGrams),
    pt: input.paymentMode === "COD" ? "COD" : "Pre-paid",
  });

  const rows = await delhiveryFetch<DelhiveryRateResponse[]>(
    `/api/kinko/v1/invoice/charges/.json?${params.toString()}`
  );

  const data = Array.isArray(rows) ? rows[0] : undefined;
  if (!data || typeof data.total_amount !== "number" || data.total_amount <= 0) return null;

  return {
    shippingCost: Math.round(data.total_amount),
    source: "delhivery_api",
    breakdown: {
      freight: data.charge_DL,
      codCharges: data.charge_COD,
      fuelSurcharge: data.charge_FSC,
    },
  };
}

async function calculateFromSlabs(input: RateInput): Promise<RateResult | null> {
  const slabs = await prisma.shippingRate.findMany({
    where: {
      isActive: true,
      minWeight: { lte: input.weightKg },
      maxWeight: { gte: input.weightKg },
    },
    orderBy: { minWeight: "asc" },
  });

  if (slabs.length === 0) return null;

  const slab = slabs[0];
  const extraWeight = Math.max(0, input.weightKg - slab.baseWeight);
  const cost = slab.baseRate + extraWeight * slab.perKgRate;

  return {
    shippingCost: Math.round(cost),
    source: "rate_slab",
  };
}

import { calculateOrderWeight } from "./weight";
export {
  calculateOrderWeight,
  itemChargeableWeightKg,
  VOLUMETRIC_DIVISOR,
  DEFAULT_ITEM_WEIGHT_KG,
  type ShippingDimensionsInput,
} from "./weight";
