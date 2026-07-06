import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

/**
 * AI vehicle detection — schema-ready stub (feature: AI-ready vehicle
 * detection). No vision model is wired up yet; this matches caller-supplied
 * label hints (e.g. from a future image-classification call) against
 * `Vehicle.aiLabels` / `ocrKeywords`, and durably logs every attempt to
 * `VehicleDetectionLog` so a real model can be dropped in later without
 * touching call sites.
 */

export interface DetectionCandidate {
  vehicleId: string;
  variantId: string | null;
  confidenceScore: number;
}

async function matchByLabels(hints: string[]): Promise<DetectionCandidate[]> {
  if (hints.length === 0) return [];
  const normalized = hints.map((h) => h.toLowerCase());

  const vehicles = await prisma.vehicle.findMany({
    where: {
      isActive: true,
      OR: [{ aiLabels: { hasSome: hints } }, { ocrKeywords: { hasSome: hints } }],
    },
    select: { id: true, aiLabels: true, ocrKeywords: true },
  });

  return vehicles
    .map((v) => {
      const tags = [...v.aiLabels, ...v.ocrKeywords].map((t) => t.toLowerCase());
      const matches = normalized.filter((h) => tags.includes(h)).length;
      return { vehicleId: v.id, variantId: null, confidenceScore: matches / normalized.length };
    })
    .filter((c) => c.confidenceScore > 0)
    .sort((a, b) => b.confidenceScore - a.confidenceScore);
}

export async function detectVehicleFromImage(
  imageUrl: string,
  hints: string[] = []
): Promise<DetectionCandidate[]> {
  const candidates = await matchByLabels(hints);

  await prisma.vehicleDetectionLog.create({
    data: {
      inputType: "IMAGE",
      imageUrl,
      rawInput: hints.length > 0 ? hints.join(", ") : null,
      detectedVehicleId: candidates[0]?.vehicleId ?? null,
      detectedVariantId: candidates[0]?.variantId ?? null,
      confidenceScore: candidates[0]?.confidenceScore ?? null,
      alternatives: candidates.length > 0 ? (candidates as unknown as Prisma.InputJsonValue) : undefined,
      method: "stub-label-match",
    },
  });

  return candidates;
}
