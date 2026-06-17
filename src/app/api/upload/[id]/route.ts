import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteProductImage, deleteFile, logStorageAction } from "@/lib/storage";

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = params;

  // Try ProductImage first
  const productImage = await prisma.productImage.findUnique({ where: { id } });
  if (productImage) {
    await deleteProductImage(productImage.key);
    await prisma.productImage.delete({ where: { id } });
    await logStorageAction({ userId: session.user.id, action: "DELETE", fileKey: productImage.key });
    return NextResponse.json({ deleted: true, type: "product-image" });
  }

  // Try DealerDocument
  const doc = await prisma.dealerDocument.findUnique({ where: { id } });
  if (doc) {
    await deleteFile(doc.key);
    await prisma.dealerDocument.delete({ where: { id } });
    await logStorageAction({ userId: session.user.id, action: "DELETE", fileKey: doc.key });
    return NextResponse.json({ deleted: true, type: "dealer-document" });
  }

  return NextResponse.json({ error: "File not found" }, { status: 404 });
}
