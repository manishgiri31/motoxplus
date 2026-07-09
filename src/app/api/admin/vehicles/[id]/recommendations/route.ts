import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const recommendations = await prisma.vehicleProductRecommendation.findMany({
    where: { vehicleId: params.id },
    orderBy: { priority: "asc" },
    include: { product: { select: { name: true, partNumber: true } } },
  });
  return NextResponse.json(
    recommendations.map((r) => ({ ...r, productName: r.product.name, productPartNumber: r.product.partNumber }))
  );
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const identifier = (body.productPartNumber || "").trim();
  if (!identifier) {
    return NextResponse.json({ error: "Product part number or SKU is required" }, { status: 400 });
  }

  const product = await prisma.product.findFirst({
    where: { OR: [{ partNumber: identifier }, { sku: identifier }, { id: identifier }] },
    select: { id: true },
  });
  if (!product) {
    return NextResponse.json({ error: `No product found matching "${identifier}"` }, { status: 404 });
  }

  try {
    const recommendation = await prisma.vehicleProductRecommendation.create({
      data: {
        vehicleId: params.id,
        productId: product.id,
        priority: body.priority ? parseInt(body.priority) : 0,
      },
    });
    return NextResponse.json(recommendation, { status: 201 });
  } catch {
    return NextResponse.json({ error: "This product is already recommended for this vehicle" }, { status: 409 });
  }
}
