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

  // 3. Default flat rate
  return { shippingCost: 100, source: "default" };
}

async function fetchDelhiveryRate(input: RateInput): Promise<RateResult | null> {
  const weightGrams = Math.round(input.weightKg * 1000);
  const codAmount = input.paymentMode === "COD" ? (input.codAmount ?? 0) : 0;

  const params = new URLSearchParams({
    md: "E",
    ss: "Delivered",
    d: String(input.weightKg),
    o: input.originPincode, // the pickup warehouse's pin, never a global default
    dc: input.destinationPincode,
    cgm: String(weightGrams),
    pt: input.paymentMode,
    cod: String(codAmount),
  });

  const data = await delhiveryFetch<DelhiveryRateResponse>(
    `/api/kinko/v1/rate-calculator/?${params.toString()}`
  );

  if (!data || typeof data.total_amount !== "number") return null;

  return {
    shippingCost: Math.round(data.total_amount),
    source: "delhivery_api",
    breakdown: {
      freight: data.freight_charge,
      codCharges: data.cod_charges,
      fuelSurcharge: data.fuel_surcharge,
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
