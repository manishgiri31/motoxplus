import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/middleware";

export async function GET(req: NextRequest) {
  const authUser = await requireAuth(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: authUser.userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: true,
      image: true,
      emailVerified: true,
      mobileNumber: true,
      mobileVerified: true,
      twoFactorEnabled: true,
      lastLogin: true,
      createdAt: true,
      dealer: { select: { id: true, companyName: true, status: true, gstNumber: true } },
      admin: { select: { isSuperAdmin: true } },
    },
  });

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  return NextResponse.json({ user });
}
