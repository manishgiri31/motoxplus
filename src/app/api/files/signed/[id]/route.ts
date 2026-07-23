import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateSignedUrl } from "@/lib/storage";

export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = params;

  const doc = await prisma.dealerDocument.findUnique({ where: { id } });
  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  if (session.user.role === "DEALER") {
    const dealer = await prisma.dealer.findUnique({ where: { userId: session.user.id } });
    if (!dealer || dealer.id !== doc.dealerId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else if (!["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const signedUrl = await generateSignedUrl(doc.key, 900); // 15 minutes
    return NextResponse.json({ signedUrl, expiresIn: 900 });
  } catch (err: any) {
    console.error("[files/signed]", err?.message ?? err);
    return NextResponse.json({ error: "Could not generate signed URL" }, { status: 500 });
  }
}
