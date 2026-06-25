import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteFromR2 } from "@/lib/r2";

const INCLUDE_IMAGES = {
  category: true,
  productImages: { orderBy: [{ isPrimary: "desc" as const }, { sortOrder: "asc" as const }] },
};

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const product = await prisma.product.findUnique({
    where: { id: params.id },
    include: INCLUDE_IMAGES,
  });

  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(product);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
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
  const product = await prisma.product.update({
    where: { id: params.id },
    data: productData,
    include: INCLUDE_IMAGES,
  });

  revalidatePath(`/products/${params.id}`);
  revalidatePath("/products");

  return NextResponse.json(product);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await prisma.product.update({
    where: { id: params.id },
    data: { isActive: false },
  });

  revalidatePath(`/products/${params.id}`);
  revalidatePath("/products");

  return NextResponse.json({ success: true });
}
