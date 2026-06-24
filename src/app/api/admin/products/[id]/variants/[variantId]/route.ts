import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) return null;
  return session;
}

const variantInclude = {
  images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] },
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; variantId: string } }
) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  const variant = await prisma.productVariant.findUnique({ where: { id: params.variantId } });
  if (!variant || variant.productId !== params.id) {
    return NextResponse.json({ error: "Variant not found" }, { status: 404 });
  }

  const updated = await (prisma.productVariant as any).update({
    where: { id: params.variantId },
    data: {
      ...(body.label !== undefined && { label: body.label.trim() }),
      ...(body.sku !== undefined && { sku: body.sku?.trim() || null }),
      ...(body.partNumber !== undefined && { partNumber: body.partNumber?.trim() || null }),
      ...(body.color !== undefined && { color: body.color?.trim() || null }),
      ...(body.vehicleModel !== undefined && { vehicleModel: body.vehicleModel?.trim() || null }),
      ...(body.finish !== undefined && { finish: body.finish?.trim() || null }),
      ...(body.size !== undefined && { size: body.size?.trim() || null }),
      ...(body.extra !== undefined && { extra: body.extra?.trim() || null }),
      ...(body.price !== undefined && { price: parseFloat(body.price) }),
      ...(body.mrp !== undefined && { mrp: body.mrp ? parseFloat(body.mrp) : null }),
      ...(body.stock !== undefined && { stock: parseInt(body.stock) }),
      ...(body.moq !== undefined && { moq: body.moq ? parseInt(body.moq) : null }),
      ...(body.imageUrl !== undefined && { imageUrl: body.imageUrl?.trim() || null }),
      ...(body.sortOrder !== undefined && { sortOrder: parseInt(body.sortOrder) }),
      ...(body.isActive !== undefined && { isActive: Boolean(body.isActive) }),
    },
    include: variantInclude,
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; variantId: string } }
) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const variant = await prisma.productVariant.findUnique({ where: { id: params.variantId } });
  if (!variant || variant.productId !== params.id) {
    return NextResponse.json({ error: "Variant not found" }, { status: 404 });
  }

  await prisma.productVariant.delete({ where: { id: params.variantId } });

  return NextResponse.json({ success: true });
}
