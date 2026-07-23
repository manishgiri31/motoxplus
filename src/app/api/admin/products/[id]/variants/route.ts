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

export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const variants = await (prisma.productVariant as any).findMany({
    where: { productId: params.id },
    include: variantInclude,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json(variants);
}

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    label, sku, partNumber, color, vehicleModel, finish, size, extra,
    price, mrp, stock, moq, imageUrl, sortOrder, images,
  } = body;

  if (!label || price == null) {
    return NextResponse.json({ error: "label and price are required" }, { status: 400 });
  }

  const product = await prisma.product.findUnique({ where: { id: params.id } });
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  const variant = await (prisma.productVariant as any).create({
    data: {
      productId: params.id,
      label: label.trim(),
      sku: sku?.trim() || null,
      partNumber: partNumber?.trim() || null,
      color: color?.trim() || null,
      vehicleModel: vehicleModel?.trim() || null,
      finish: finish?.trim() || null,
      size: size?.trim() || null,
      extra: extra?.trim() || null,
      price: parseFloat(price),
      mrp: mrp ? parseFloat(mrp) : null,
      stock: stock ? parseInt(stock) : 0,
      moq: moq ? parseInt(moq) : null,
      imageUrl: imageUrl?.trim() || null,
      sortOrder: sortOrder ? parseInt(sortOrder) : 0,
      images: Array.isArray(images) && images.length > 0 ? {
        create: images.map((img: { url: string; isPrimary?: boolean }, i: number) => ({
          imageUrl: img.url,
          isPrimary: img.isPrimary ?? i === 0,
          sortOrder: i,
        })),
      } : undefined,
    },
    include: variantInclude,
  });

  return NextResponse.json(variant, { status: 201 });
}
