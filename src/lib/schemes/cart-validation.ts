import { prisma } from "@/lib/prisma";
import { roundToPaise } from "@/lib/utils";
import { evaluateSchemeEligibility, valuateSchemeItems, isSchemeWithinWindow, type SchemeTerms } from "./pricing";

export interface RegularCartLine {
  unitPrice: number;
  quantity: number;
}

export interface SchemeItemCandidate {
  productId: string;
  quantity: number;
  /** Product.price / ProductVariant.price, read fresh — never trust a client-supplied number. */
  dealerPrice: number;
  categoryId: string;
  stockStatus: string;
  /** null for a plain product (governed by stockStatus instead); a real count for a variant. */
  variantStock: number | null;
}

export type SchemeValidationResult =
  | {
      ok: true;
      scheme: { id: string; benefitPercent: number; minOrderValue: number; maxBenefitValue: number | null };
      taxableValue: number;
      benefit: number;
      itemsValue: number;
    }
  | { ok: false; reason: string };

/** Taxable value = sum of the dealer's regular (non-scheme) cart lines, excl. GST — the same base 18% GST would apply to. */
export function computeTaxableValue(regularItems: RegularCartLine[]): number {
  return roundToPaise(regularItems.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0));
}

/**
 * Full server-side re-validation of a scheme against the dealer's current
 * regular cart lines + the scheme items they've picked. This is the single
 * place that logic lives — POST /api/cart/scheme, GET /api/cart (freshness
 * check), and POST /api/orders all call this instead of each re-implementing
 * "is this scheme still valid", so they can't drift into disagreeing about
 * what "valid" means. Never trusts a client-supplied benefit/eligibility —
 * everything here is re-derived from freshly-passed-in DB reads.
 */
export async function validateSchemeSelection(params: {
  schemeId: string;
  regularItems: RegularCartLine[];
  schemeItems: SchemeItemCandidate[];
}): Promise<SchemeValidationResult> {
  const scheme = await prisma.scheme.findUnique({
    where: { id: params.schemeId },
    include: { eligibleCategories: { select: { categoryId: true } } },
  });
  if (!scheme) return { ok: false, reason: "Scheme not found" };

  const now = new Date();
  if (!isSchemeWithinWindow({ isActive: scheme.isActive, startsAt: scheme.startsAt, endsAt: scheme.endsAt, now })) {
    return { ok: false, reason: "This scheme is not currently active" };
  }

  const taxableValue = computeTaxableValue(params.regularItems);
  const terms: SchemeTerms = {
    benefitPercent: scheme.benefitPercent,
    minOrderValue: scheme.minOrderValue,
    maxBenefitValue: scheme.maxBenefitValue,
  };
  const eligibility = evaluateSchemeEligibility({ taxableValue, terms });
  if (!eligibility.eligible) {
    return { ok: false, reason: `Order value must be at least ₹${scheme.minOrderValue} to qualify for this scheme` };
  }

  const eligibleCategoryIds = new Set(scheme.eligibleCategories.map((c) => c.categoryId));
  const allCategoriesEligible = eligibleCategoryIds.size === 0;

  for (const item of params.schemeItems) {
    if (!allCategoriesEligible && !eligibleCategoryIds.has(item.categoryId)) {
      return { ok: false, reason: "One or more selected free items are not eligible under this scheme" };
    }
    const outOfStock =
      item.variantStock != null ? item.variantStock < item.quantity : item.stockStatus === "OUT_OF_STOCK";
    if (outOfStock) {
      return { ok: false, reason: "One or more selected free items are out of stock" };
    }
  }

  const valuation = valuateSchemeItems({
    items: params.schemeItems.map((i) => ({ productId: i.productId, quantity: i.quantity, dealerPrice: i.dealerPrice })),
    benefit: eligibility.benefit,
  });
  if (!valuation.withinBenefit) {
    return {
      ok: false,
      reason: `Selected free items (₹${valuation.itemsValue}) exceed the earned benefit (₹${eligibility.benefit})`,
    };
  }

  return {
    ok: true,
    scheme: { id: scheme.id, benefitPercent: scheme.benefitPercent, minOrderValue: scheme.minOrderValue, maxBenefitValue: scheme.maxBenefitValue },
    taxableValue,
    benefit: eligibility.benefit,
    itemsValue: valuation.itemsValue,
  };
}
