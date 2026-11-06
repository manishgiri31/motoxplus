import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";
import { badRequest, categoryReorderSchema, invalidateCategories } from "@/lib/catalog/category-admin";

/**
 * POST /api/admin/categories/reorder — { parentId, orderedIds } sets the display order of one
 * sibling set (top-level categories when parentId is null). orderedIds must be exactly that set.
 */
export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { parentId, orderedIds } = categoryReorderSchema.parse(await req.json());
    const siblings = await prisma.category.findMany({ where: { parentId }, select: { id: true } });
    const expected = new Set(siblings.map((s) => s.id));
    if (new Set(orderedIds).size !== orderedIds.length || orderedIds.length !== expected.size || orderedIds.some((id) => !expected.has(id))) {
      return badRequest("The category list changed. Reload and try again.", 409);
    }
    await prisma.$transaction(
      orderedIds.map((id, i) => prisma.category.update({ where: { id }, data: { sortOrder: i + 1 } }))
    );
    invalidateCategories();
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) return badRequest("Invalid data");
    console.error("[admin/categories] reorder failed", e);
    return NextResponse.json({ error: "Could not reorder categories" }, { status: 500 });
  }
}
