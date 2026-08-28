import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/middleware";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  // F-14b: getAuthUser now cross-checks UserSession.isActive/expiresAt, so a
  // disabled account / logout-all / password reset invalidates the Bearer path
  // here too (previously this hand-rolled verifyAccessToken and never checked).
  const payload = await getAuthUser(req);
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: { dealer: true },
    });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        emailVerified: !!user.emailVerified,
        mobileVerified: user.mobileVerified,
        isActive: user.isActive,
      },
      dealer: user.dealer
        ? {
            id: user.dealer.id,
            companyName: user.dealer.companyName,
            ownerName: user.dealer.ownerName,
            phone: user.dealer.phone,
            state: user.dealer.state,
            city: user.dealer.city,
            address: user.dealer.address,
            pincode: user.dealer.pincode,
            gstNumber: user.dealer.gstNumber,
            status: user.dealer.status,
            creditLimit: user.dealer.creditLimit,
          }
        : null,
    });
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }
}
