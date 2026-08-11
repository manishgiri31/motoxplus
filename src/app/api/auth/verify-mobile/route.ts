import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyOTP } from "@/lib/auth/otp";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { enforceRateLimit, rejectOversizedBody, JSON_BODY_MAX_BYTES } from "@/lib/auth/rate-limit-budgets";

export async function POST(req: NextRequest) {
  const oversized = rejectOversizedBody(req, JSON_BODY_MAX_BYTES);
  if (oversized) return oversized;

  const userId = await getCurrentUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = await enforceRateLimit(req, "OTP_VERIFY", userId);
  if (limited) return limited;

  const { otp } = await req.json();
  if (!otp) return NextResponse.json({ error: "OTP is required" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (user.mobileVerified) return NextResponse.json({ error: "Mobile already verified" }, { status: 400 });

  const result = await verifyOTP(userId, "MOBILE_VERIFICATION", otp);
  if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 });

  await prisma.user.update({
    where: { id: userId },
    data: { mobileVerified: true, mobileVerifiedAt: new Date() },
  });

  return NextResponse.json({ message: "Mobile number verified successfully" });
}
