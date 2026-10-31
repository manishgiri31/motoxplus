import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth/current-user";

// Lists the signed-in dealer's uploaded KYC documents (metadata only). The
// /dealer/documents page reads the same rows server-side via Prisma; this
// route exists so the mobile app (Bearer auth) can show the same checklist.
// Like POST /api/upload/dealer-document, it deliberately never returns
// fileUrl/key — a document is only viewable through a short-lived link from
// /api/files/signed/[id].
export async function GET(req: NextRequest) {
  const userId = await getCurrentUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const authUser = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!authUser || authUser.role !== "DEALER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dealer = await prisma.dealer.findUnique({ where: { userId }, select: { id: true } });
  if (!dealer) return NextResponse.json({ error: "Dealer not found" }, { status: 404 });

  const documents = await prisma.dealerDocument.findMany({
    where: { dealerId: dealer.id },
    select: { id: true, documentType: true, fileName: true, fileSize: true, uploadedAt: true },
    orderBy: { uploadedAt: "desc" },
  });

  return NextResponse.json({ documents });
}
