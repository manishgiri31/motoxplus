import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createOTP, checkResendLimit, OTP_EXPIRY_MINUTES } from "@/lib/auth/otp";
import { sendOTP } from "@/lib/sms";
import { enforceRateLimit, rejectOversizedBody, JSON_BODY_MAX_BYTES } from "@/lib/auth/rate-limit-budgets";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { normalizeIndianMobile } from "@/lib/phone";

export async function POST(req: NextRequest) {
  const oversized = rejectOversizedBody(req, JSON_BODY_MAX_BYTES);
  if (oversized) return oversized;

  const userId = await getCurrentUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { mobile } = await req.json();
  if (!mobile) return NextResponse.json({ error: "Mobile number is required" }, { status: 400 });

  const normalizedMobile = normalizeIndianMobile(mobile);
  if (!normalizedMobile) {
    return NextResponse.json({ error: "Invalid Indian mobile number" }, { status: 400 });
  }

  // Per-IP AND per-phone, checked once the number is known to be well-formed
  // — this is an OTP send (WhatsApp/SMS cost), the strictest budget class.
  const limited = await enforceRateLimit(req, "OTP_SEND", normalizedMobile);
  if (limited) return limited;

  const existingUser = await prisma.user.findUnique({ where: { mobileNumber: normalizedMobile } });
  if (existingUser && existingUser.id !== userId) {
    return NextResponse.json({ error: "Mobile number already registered to another account" }, { status: 409 });
  }

  // Save mobile number
  await prisma.user.update({ where: { id: userId }, data: { mobileNumber: normalizedMobile } });

  const canResend = await checkResendLimit(userId, "MOBILE_VERIFICATION");
  if (!canResend) return NextResponse.json({ error: "Too many OTP requests. Try again in 1 hour." }, { status: 429 });

  const code = await createOTP(userId, "MOBILE_VERIFICATION");
  const smsResult = await sendOTP(normalizedMobile, code);
  if (!smsResult.success) {
    return NextResponse.json({ error: "Failed to send OTP. Try again." }, { status: 500 });
  }

  return NextResponse.json({ message: "OTP sent to your mobile number", expires: OTP_EXPIRY_MINUTES });
}
