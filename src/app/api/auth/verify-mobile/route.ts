import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyOTP } from "@/lib/auth/otp";
import { requireAuth } from "@/lib/auth/middleware";

export async function POST(req: NextRequest) {
  const authUser = await requireAuth(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { otp } = await req.json();
  if (!otp) return NextResponse.json({ error: "OTP is required" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: authUser.userId } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (user.mobileVerified) return NextResponse.json({ error: "Mobile already verified" }, { status: 400 });

  const result = await verifyOTP(authUser.userId, "MOBILE_VERIFICATION", otp);
  if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 });

  await prisma.user.update({
    where: { id: authUser.userId },
    data: { mobileVerified: true, mobileVerifiedAt: new Date() },
  });

  return NextResponse.json({ message: "Mobile number verified successfully" });
}
