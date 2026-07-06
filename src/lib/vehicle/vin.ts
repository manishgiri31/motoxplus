import { prisma } from "@/lib/prisma";

/**
 * VIN/chassis-number decoding — schema-ready stub (feature: VIN-ready
 * architecture). Parses the WMI (world manufacturer identifier, chars 1-3)
 * and standard VIN year code (char 10), then looks up `VehicleVinPattern`
 * rows (optionally narrowed by a regex `vdsPattern`) to resolve manufacturer
 * → vehicle → variant. Ready to back a future VIN-scan feature once real
 * pattern data is populated per manufacturer.
 */

export interface VinDecodeResult {
  manufacturerId: string | null;
  vehicleId: string | null;
  variantId: string | null;
  yearGuess: number | null;
  matchedPattern: string | null;
}

// Standard 17-digit VIN position-10 year code, most recent cycle.
const VIN_YEAR_CODES: Record<string, number> = {
  A: 2010, B: 2011, C: 2012, D: 2013, E: 2014, F: 2015, G: 2016, H: 2017,
  J: 2018, K: 2019, L: 2020, M: 2021, N: 2022, P: 2023, R: 2024, S: 2025,
  T: 2026, V: 2027, W: 2028, X: 2029, Y: 2030,
  "1": 2001, "2": 2002, "3": 2003, "4": 2004, "5": 2005, "6": 2006, "7": 2007, "8": 2008, "9": 2009,
};

const EMPTY_RESULT: VinDecodeResult = {
  manufacturerId: null,
  vehicleId: null,
  variantId: null,
  yearGuess: null,
  matchedPattern: null,
};

export async function decodeVin(vin: string): Promise<VinDecodeResult> {
  const normalized = vin.trim().toUpperCase();
  if (normalized.length < 3) return EMPTY_RESULT;

  const wmi = normalized.slice(0, 3);
  const yearCode = normalized.length >= 10 ? normalized[9] : null;
  const yearGuess = yearCode ? VIN_YEAR_CODES[yearCode] ?? null : null;

  const patterns = await prisma.vehicleVinPattern.findMany({ where: { wmi } });

  let best: (typeof patterns)[number] | null = null;
  for (const p of patterns) {
    if (!p.vdsPattern) {
      best = best ?? p;
      continue;
    }
    try {
      if (new RegExp(p.vdsPattern).test(normalized)) {
        best = p;
        break;
      }
    } catch {
      // malformed pattern in data — skip it
    }
  }

  if (!best) {
    const manufacturer = await prisma.vehicleManufacturer.findFirst({ where: { wmi } });
    return { ...EMPTY_RESULT, manufacturerId: manufacturer?.id ?? null, yearGuess };
  }

  return {
    manufacturerId: best.manufacturerId,
    vehicleId: best.vehicleId,
    variantId: best.variantId,
    yearGuess,
    matchedPattern: best.vdsPattern ?? best.wmi,
  };
}
