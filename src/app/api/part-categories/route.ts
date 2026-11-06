import { NextRequest, NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/auth/rate-limit-budgets";
import { getPartCategoryTree } from "@/lib/catalog/part-categories";

/**
 * GET /api/part-categories — the automotive parts catalogue suppliers choose from when they apply.
 * Public (the application form is pre-login). Ported 1:1 in Java (PartCategoryController).
 *
 * 200 -> { groups: [{ id, name, slug, children: [{ id, name, slug }] }] }
 */
export async function GET(req: NextRequest) {
  const limited = await enforceRateLimit(req, "PUBLIC_API");
  if (limited) return limited;

  const groups = await getPartCategoryTree();
  return NextResponse.json(
    { groups },
    { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } }
  );
}
