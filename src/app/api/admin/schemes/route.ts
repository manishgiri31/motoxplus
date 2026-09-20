import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

const schemeSchema = z.object({
  name: z.string().min(2),
  code: z.string().min(2).toUpperCase(),
  isActive: z.boolean().default(true),
  benefitPercent: z.number().min(0).max(100).default(18),
  minOrderValue: z.number().min(0),
  maxBenefitValue: z.number().min(0).nullable().optional(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  // Empty = every category eligible (see Scheme.eligibleCategories doc comment).
  categoryIds: z.array(z.string()).default([]),
});

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !ADMIN_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = 20;

  const [schemes, total] = await Promise.all([
    prisma.scheme.findMany({
      include: {
        eligibleCategories: { include: { category: { select: { id: true, name: true } } } },
        _count: { select: { redemptions: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.scheme.count(),
  ]);

  return NextResponse.json({ schemes, total, page, pageSize });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !ADMIN_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { categoryIds, ...data } = schemeSchema.parse(body);

    if (data.endsAt <= data.startsAt) {
      return NextResponse.json({ error: "endsAt must be after startsAt" }, { status: 400 });
    }

    const conflict = await prisma.scheme.findUnique({ where: { code: data.code }, select: { code: true } });
    if (conflict) {
      return NextResponse.json({ error: `Duplicate code: a scheme with code "${data.code}" already exists` }, { status: 409 });
    }

    const scheme = await prisma.scheme.create({
      data: {
        ...data,
        eligibleCategories: { create: categoryIds.map((categoryId) => ({ categoryId })) },
      },
    });

    return NextResponse.json({ scheme });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message || "Invalid scheme data" }, { status: 400 });
    }
    throw err;
  }
}
