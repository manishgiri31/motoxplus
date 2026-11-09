import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

// Staff confirmation that they have checked the dealer's GST number by hand
// (e.g. against the certificate) — the manual counterpart to the automatic
// GST-registry check (backend-java gst/*), for when that check can't settle
// it. Recorded with source "ADMIN" so the two are never confused.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || !ADMIN_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { verified } = await req.json();

  const dealer = await prisma.dealer.findUnique({ where: { id }, select: { gstNumber: true } });
  if (!dealer?.gstNumber) {
    return NextResponse.json({ error: "This dealer has not provided a GST number" }, { status: 400 });
  }

  const updated = await prisma.dealer.update({
    where: { id },
    data: {
      gstVerified: verified !== false,
      gstVerifiedAt: verified !== false ? new Date() : null,
      // Cleared by staff = not verified, and not re-queued for the automatic
      // re-check either (that would silently overrule the staff decision).
      gstVerificationStatus: verified !== false ? "VERIFIED" : null,
      gstVerificationSource: "ADMIN",
    },
    select: { id: true, gstNumber: true, gstVerified: true, gstVerifiedAt: true },
  });

  return NextResponse.json({ dealer: updated, message: updated.gstVerified ? "GST marked as verified" : "GST verification cleared" });
}
