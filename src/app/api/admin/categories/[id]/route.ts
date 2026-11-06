import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";
import {
  badRequest,
  categoryUpdateSchema,
  checkParent,
  invalidateCategories,
  isUniqueViolation,
} from "@/lib/catalog/category-admin";

/**
 * PATCH /api/admin/categories/:id — rename, describe, (de)activate or move a category.
 * There is no DELETE: products, schemes and vendor approvals reference categories, so admins
 * deactivate instead. Deactivated categories disappear from the shop and the supplier form, but
 * existing products and vendor links are kept. The slug never changes (it is in storefront URLs).
 */
export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await props.params;

  try {
    const data = categoryUpdateSchema.parse(await req.json());
    const current = await prisma.category.findUnique({
      where: { id },
      select: { id: true, parentId: true, _count: { select: { children: true } } },
    });
    if (!current) return badRequest("Category not found", 404);

    let sortOrder: number | undefined;
    if (data.parentId !== undefined && data.parentId !== current.parentId) {
      if (data.parentId) {
        if (current._count.children > 0) return badRequest("Move or remove its subcategories first: only two levels are supported");
        const problem = await checkParent(data.parentId, id);
        if (problem) return badRequest(problem);
      }
      const last = await prisma.category.aggregate({ where: { parentId: data.parentId }, _max: { sortOrder: true } });
      sortOrder = (last._max.sortOrder ?? 0) + 1;
    }

    const category = await prisma.category.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description || null }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.parentId !== undefined && { parentId: data.parentId }),
        ...(sortOrder !== undefined && { sortOrder }),
      },
    });
    invalidateCategories();
    return NextResponse.json({ category });
  } catch (e) {
    if (e instanceof z.ZodError) return badRequest(e.issues[0]?.message ?? "Invalid data");
    if (isUniqueViolation(e)) return badRequest("A category with this name already exists", 409);
    console.error("[admin/categories] update failed", e);
    return NextResponse.json({ error: "Could not update category" }, { status: 500 });
  }
}
