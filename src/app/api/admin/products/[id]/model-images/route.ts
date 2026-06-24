import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET: list all unique vehicleModels for this product + their current imageUrl
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const variants = await (prisma.productVariant as any).findMany({
    where: { productId: params.id, isActive: true },
    select: { vehicleModel: true, imageUrl: true },
    orderBy: { sortOrder: "asc" },
  });

  // Deduplicate by vehicleModel, keeping the first imageUrl seen
  const seen = new Map<string, string | null>();
  const countMap = new Map<string, number>();
  for (const v of variants) {
    if (!v.vehicleModel) continue;
    if (!seen.has(v.vehicleModel)) seen.set(v.vehicleModel, v.imageUrl ?? null);
    countMap.set(v.vehicleModel, (countMap.get(v.vehicleModel) ?? 0) + 1);
  }

  const models = Array.from(seen.entries()).map(([vehicleModel, imageUrl]) => ({
    vehicleModel,
    imageUrl,
    variantCount: countMap.get(vehicleModel) ?? 0,
  }));

  return NextResponse.json({ models });
}

// PUT: set imageUrl for ALL variants of a given vehicleModel
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { vehicleModel, imageUrl } = await req.json();
  if (!vehicleModel) return NextResponse.json({ error: "vehicleModel required" }, { status: 400 });

  const result = await (prisma.productVariant as any).updateMany({
    where: { productId: params.id, vehicleModel },
    data: { imageUrl: imageUrl || null },
  });

  return NextResponse.json({ updated: result.count });
}
