import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const userId = await getCurrentUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const authUser = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = params;

  // Check ProductImage
  const productImage = await prisma.productImage.findUnique({ where: { id } });
  if (productImage) {
    if (!["ADMIN", "SUPER_ADMIN"].includes(authUser.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({
      id: productImage.id,
      type: "product-image",
      url: productImage.imageUrl,
      mediumUrl: productImage.mediumUrl,
      thumbnailUrl: productImage.thumbnailUrl,
      key: productImage.key,
      fileName: productImage.fileName,
      fileSize: productImage.fileSize,
      mimeType: productImage.mimeType,
      isPrimary: productImage.isPrimary,
      sortOrder: productImage.sortOrder,
      createdAt: productImage.createdAt,
    });
  }

  // Check DealerDocument
  const doc = await prisma.dealerDocument.findUnique({ where: { id } });
  if (doc) {
    // Dealers can only see their own docs; admins can see all
    if (authUser.role === "DEALER") {
      const dealer = await prisma.dealer.findUnique({ where: { userId } });
      if (!dealer || dealer.id !== doc.dealerId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else if (!["ADMIN", "SUPER_ADMIN"].includes(authUser.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({
      id: doc.id,
      type: "dealer-document",
      documentType: doc.documentType,
      fileName: doc.fileName,
      fileSize: doc.fileSize,
      mimeType: doc.mimeType,
      key: doc.key,
      uploadedAt: doc.uploadedAt,
    });
  }

  return NextResponse.json({ error: "File not found" }, { status: 404 });
}
