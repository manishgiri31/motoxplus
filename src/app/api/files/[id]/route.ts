import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = params;

  // Check ProductImage
  const productImage = await prisma.productImage.findUnique({ where: { id } });
  if (productImage) {
    if (!["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
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
    if (session.user.role === "DEALER") {
      const dealer = await prisma.dealer.findUnique({ where: { userId: session.user.id } });
      if (!dealer || dealer.id !== doc.dealerId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else if (!["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
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
