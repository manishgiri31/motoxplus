import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

// Internal-only confirmation that staff have checked the vendor's GST number —
// never calls an external GST verification API, per business rules.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !ADMIN_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { verified } = await req.json();

  const vendor = await prisma.vendor.findUnique({ where: { id: params.id }, select: { gstNumber: true } });
  if (!vendor?.gstNumber) {
    return NextResponse.json({ error: "This vendor has not provided a GST number" }, { status: 400 });
  }

  const updated = await prisma.vendor.update({
    where: { id: params.id },
    data: {
      gstVerified: verified !== false,
      gstVerifiedAt: verified !== false ? new Date() : null,
    },
    select: { id: true, gstNumber: true, gstVerified: true, gstVerifiedAt: true },
  });

  return NextResponse.json({ vendor: updated, message: updated.gstVerified ? "GST marked as verified" : "GST verification cleared" });
}
