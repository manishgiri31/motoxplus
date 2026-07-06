import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

/**
 * OCR-based bike identification — schema-ready stub (feature: future
 * OCR-based bike identification). Takes raw OCR'd text (e.g. from a badge,
 * plate, or service-sticker photo) and token-matches it against vehicle
 * name/aliases/ocrKeywords/badgeText. Logs every attempt to
 * `VehicleDetectionLog` so a real OCR pipeline can replace the token match
 * later without changing the call site.
 */

export interface OcrCandidate {
  vehicleId: string;
  variantId: string | null;
  confidenceScore: number;
}

export async function identifyFromText(text: string): Promise<OcrCandidate[]> {
  const tokens = text.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];

  const vehicles = await prisma.vehicle.findMany({
    where: { isActive: true },
    select: { id: true, name: true, searchAliases: true, ocrKeywords: true, badgeText: true },
  });

  const candidates: OcrCandidate[] = vehicles
    .map((v) => {
      const haystack = [v.name, v.badgeText ?? "", ...v.searchAliases, ...v.ocrKeywords]
        .join(" ")
        .toLowerCase();
      const matches = tokens.filter((t) => haystack.includes(t)).length;
      return { vehicleId: v.id, variantId: null, confidenceScore: matches / tokens.length };
    })
    .filter((c) => c.confidenceScore > 0)
    .sort((a, b) => b.confidenceScore - a.confidenceScore);

  if (candidates.length > 0) {
    await prisma.vehicleDetectionLog.create({
      data: {
        inputType: "OCR_TEXT",
        rawInput: text,
        detectedVehicleId: candidates[0].vehicleId,
        confidenceScore: candidates[0].confidenceScore,
        alternatives: candidates as unknown as Prisma.InputJsonValue,
        method: "stub-token-match",
      },
    });
  }

  return candidates;
}
