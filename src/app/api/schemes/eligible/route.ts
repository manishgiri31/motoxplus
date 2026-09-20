import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { evaluateSchemeEligibility } from "@/lib/schemes/pricing";

/**
 * Read-only: which currently-active GST Benefit Schemes a given cart/order
 * taxable value would qualify for, and what benefit each earns. Informational
 * only — the client never gets to pick which scheme wins here; the actual
 * selection + full re-validation happens in POST /api/cart/scheme.
 */
export async function GET(req: NextRequest) {
  const userId = await getCurrentUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const authUser = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!authUser || authUser.role !== "DEALER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const orderValue = Number(searchParams.get("orderValue"));
  if (!Number.isFinite(orderValue) || orderValue < 0) {
    return NextResponse.json({ error: "orderValue must be a non-negative number" }, { status: 400 });
  }

  const now = new Date();
  const schemes = await prisma.scheme.findMany({
    where: { isActive: true, startsAt: { lte: now }, endsAt: { gte: now } },
    include: { eligibleCategories: { select: { categoryId: true } } },
    orderBy: { createdAt: "desc" },
  });

  const eligible = schemes
    .map((scheme) => {
      const evaluation = evaluateSchemeEligibility({
        taxableValue: orderValue,
        terms: {
          benefitPercent: scheme.benefitPercent,
          minOrderValue: scheme.minOrderValue,
          maxBenefitValue: scheme.maxBenefitValue,
        },
      });
      if (!evaluation.eligible) return null;
      return {
        id: scheme.id,
        name: scheme.name,
        code: scheme.code,
        benefitPercent: scheme.benefitPercent,
        minOrderValue: scheme.minOrderValue,
        maxBenefitValue: scheme.maxBenefitValue,
        benefit: evaluation.benefit,
        // Empty = every category eligible (see Scheme.eligibleCategories doc comment).
        eligibleCategoryIds: scheme.eligibleCategories.map((c) => c.categoryId),
      };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);

  return NextResponse.json({ schemes: eligible });
}
