import { NextRequest, NextResponse } from "next/server";
import { BROWSABLE_CATEGORY_WHERE } from "@/lib/catalog/storefront-categories";
import { revalidateTag } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";
import { enforceRateLimit } from "@/lib/auth/rate-limit-budgets";

export async function GET(req: NextRequest) {
  const limited = await enforceRateLimit(req, "PUBLIC_API");
  if (limited) return limited;

  // Only categories with something to browse (see storefront-categories.ts); the supplier
  // catalogue lives at GET /api/part-categories.
  const categories = await prisma.category.findMany({
    where: BROWSABLE_CATEGORY_WHERE,
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { products: true } } },
  });
  return NextResponse.json(categories);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name, description, image } = await req.json();
  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const category = await prisma.category.create({
    data: { name, slug: slugify(name), description, image },
  });

  revalidateTag("categories");
  return NextResponse.json(category, { status: 201 });
}
