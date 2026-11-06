import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";
import {
  badRequest,
  categoryCreateSchema,
  checkParent,
  invalidateCategories,
  isUniqueViolation,
  uniqueCategorySlug,
} from "@/lib/catalog/category-admin";

/** GET /api/admin/categories — every category (active or not) with usage counts, in tree order. */
export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const categories = await prisma.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true, name: true, slug: true, description: true, isActive: true, sortOrder: true, parentId: true,
      _count: { select: { products: true, vendors: true, children: true } },
    },
  });
  return NextResponse.json({ categories });
}

/** POST /api/admin/categories — create a top-level category or (with parentId) a subcategory, appended last. */
export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const data = categoryCreateSchema.parse(await req.json());
    const parentId = data.parentId ?? null;
    if (parentId) {
      const problem = await checkParent(parentId);
      if (problem) return badRequest(problem);
    }
    const last = await prisma.category.aggregate({ where: { parentId }, _max: { sortOrder: true } });
    const category = await prisma.category.create({
      data: {
        name: data.name,
        slug: await uniqueCategorySlug(data.name),
        description: data.description || null,
        parentId,
        sortOrder: (last._max.sortOrder ?? 0) + 1,
      },
    });
    invalidateCategories();
    return NextResponse.json({ category }, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) return badRequest(e.issues[0]?.message ?? "Invalid data");
    if (isUniqueViolation(e)) return badRequest("A category with this name already exists", 409);
    console.error("[admin/categories] create failed", e);
    return NextResponse.json({ error: "Could not create category" }, { status: 500 });
  }
}
