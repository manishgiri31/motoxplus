import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { type } = await req.json();

  const now = new Date();
  const updateData =
    type === "mobile"
      ? { mobileVerified: true, mobileVerifiedAt: now }
      : { emailVerified: now, emailVerifiedAt: now };

  const user = await prisma.user.update({
    where: { id },
    data: updateData,
    select: { id: true, email: true, emailVerified: true, mobileVerified: true },
  });

  return NextResponse.json({ user, message: `${type === "mobile" ? "Mobile" : "Email"} verified by admin` });
}
