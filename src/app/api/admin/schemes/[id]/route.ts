import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

const schemeUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  code: z.string().min(2).toUpperCase().optional(),
  isActive: z.boolean().optional(),
  benefitPercent: z.number().min(0).max(100).optional(),
  minOrderValue: z.number().min(0).optional(),
  maxBenefitValue: z.number().min(0).nullable().optional(),
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().optional(),
  // When provided, fully replaces the eligible-category set. Omit to leave it unchanged.
  categoryIds: z.array(z.string()).optional(),
});

export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || !ADMIN_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const params = await props.params;

  const scheme = await prisma.scheme.findUnique({
    where: { id: params.id },
    include: { eligibleCategories: { include: { category: { select: { id: true, name: true } } } } },
  });
  if (!scheme) return NextResponse.json({ error: "Scheme not found" }, { status: 404 });

  return NextResponse.json({ scheme });
}

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || !ADMIN_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const params = await props.params;

  try {
    const body = await req.json();
    const { categoryIds, ...data } = schemeUpdateSchema.parse(body);

    const existing = await prisma.scheme.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ error: "Scheme not found" }, { status: 404 });

    const startsAt = data.startsAt ?? existing.startsAt;
    const endsAt = data.endsAt ?? existing.endsAt;
    if (endsAt <= startsAt) {
      return NextResponse.json({ error: "endsAt must be after startsAt" }, { status: 400 });
    }

    if (data.code && data.code !== existing.code) {
      const conflict = await prisma.scheme.findUnique({ where: { code: data.code }, select: { id: true } });
      if (conflict) {
        return NextResponse.json({ error: `Duplicate code: a scheme with code "${data.code}" already exists` }, { status: 409 });
      }
    }

    const scheme = await prisma.$transaction(async (tx) => {
      if (categoryIds !== undefined) {
        await tx.schemeCategory.deleteMany({ where: { schemeId: params.id } });
        if (categoryIds.length > 0) {
          await tx.schemeCategory.createMany({ data: categoryIds.map((categoryId) => ({ schemeId: params.id, categoryId })) });
        }
      }
      return tx.scheme.update({
        where: { id: params.id },
        data,
        include: { eligibleCategories: { include: { category: { select: { id: true, name: true } } } } },
      });
    });

    return NextResponse.json({ scheme });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message || "Invalid scheme data" }, { status: 400 });
    }
    throw err;
  }
}
