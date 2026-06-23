import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "@/lib/auth/jwt";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = await verifyAccessToken(token);
    if (!payload) return NextResponse.json({ error: "Invalid token" }, { status: 401 });
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
