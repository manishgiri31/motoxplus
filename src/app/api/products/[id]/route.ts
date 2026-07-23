import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { deleteFromR2 } from "@/lib/r2";

const INCLUDE_IMAGES = {
  category: true,
  productImages: { orderBy: [{ isPrimary: "desc" as const }, { sortOrder: "asc" as const }] },
};

export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const product = await prisma.product.findUnique({
    where: { id: params.id },
    include: INCLUDE_IMAGES,
  });

  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(product);
}

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { productImages, deletedImageKeys, ...data } = body;

  // Delete removed images from R2 + DB
  if (deletedImageKeys?.length) {
    await Promise.all(
      deletedImageKeys.map(async (key: string) => {
        try { await deleteFromR2(key); } catch { /* ignore R2 errors */ }
        await prisma.productImage.deleteMany({ where: { key, productId: params.id } });
      })
    );
  }

  // Handle image records
  if (Array.isArray(productImages)) {
    for (const img of productImages) {
      if (img.id) {
        // Update existing
        await prisma.productImage.update({
          where: { id: img.id },
          data: { isPrimary: img.isPrimary, sortOrder: img.sortOrder },
        });
      } else {
        // Create new
        await prisma.productImage.create({
          data: {
            productId: params.id,
            imageUrl: img.url,
            key: img.key,
            isPrimary: img.isPrimary,
            sortOrder: img.sortOrder,
          },
        });
      }
    }
  }

  // Update product fields (strip image-management keys)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { images: _images, ...productData } = data;

  // Check for SKU/partNumber conflicts with OTHER products before update
  const conflictChecks: { sku?: string; partNumber?: string }[] = [];
  if (productData.sku) conflictChecks.push({ sku: productData.sku });
  if (productData.partNumber) conflictChecks.push({ partNumber: productData.partNumber });
  if (conflictChecks.length > 0) {
    const conflict = await prisma.product.findFirst({
      where: { OR: conflictChecks, NOT: { id: params.id } },
      select: { sku: true, partNumber: true },
    });
    if (conflict) {
      const field = productData.sku && conflict.sku === productData.sku ? "SKU" : "Part Number";
      const value = field === "SKU" ? productData.sku : productData.partNumber;
      return NextResponse.json(
        { error: `Duplicate ${field}: a product with ${field} "${value}" already exists` },
        { status: 409 }
      );
    }
  }

  try {
    const product = await prisma.product.update({
      where: { id: params.id },
      data: productData,
      include: INCLUDE_IMAGES,
    });

    revalidatePath(`/products/${params.id}`);
    revalidatePath("/products");

    return NextResponse.json(product);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const fields = (err.meta?.target as string[]) ?? [];
      const field = fields.includes("partNumber") ? "Part Number" : "SKU";
      return NextResponse.json({ error: `Duplicate ${field}: another product uses the same value` }, { status: 409 });
    }
    throw err;
  }
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const product = await prisma.product.findUnique({
    where: { id: params.id },
    select: { id: true, name: true, _count: { select: { orderItems: true } } },
  });

  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  if (product._count.orderItems > 0) {
    return NextResponse.json(
      { error: `Cannot delete "${product.name}" — it appears in ${product._count.orderItems} order(s). Deactivate it instead.` },
      { status: 409 }
    );
  }

  // Also delete images from R2 before removing the product
  const images = await prisma.productImage.findMany({
    where: { productId: params.id },
    select: { key: true },
  });
  await Promise.allSettled(images.map((img) => img.key ? deleteFromR2(img.key) : Promise.resolve()));

  await prisma.product.delete({ where: { id: params.id } });

  revalidatePath("/products");
  revalidatePath("/admin/products");

  return NextResponse.json({ success: true });
}
