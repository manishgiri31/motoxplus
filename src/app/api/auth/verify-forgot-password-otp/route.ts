import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyOTP } from "@/lib/auth/otp";
import { enforceRateLimit, rejectOversizedBody, JSON_BODY_MAX_BYTES } from "@/lib/auth/rate-limit-budgets";
import crypto from "crypto";

// Same message/status forgot-password's real OTP-mismatch path would give —
// forgot-password hands back an opaque, same-shaped userId for accounts that
// don't exist (see its opaqueFlowId()), specifically so this route can't be
// used to tell "no such user" apart from "real user, wrong/expired code" by
// returning a different error here.
const GENERIC_OTP_FAILURE = NextResponse.json({ error: "Invalid or expired OTP" }, { status: 400 });

export async function POST(req: NextRequest) {
  const oversized = rejectOversizedBody(req, JSON_BODY_MAX_BYTES);
  if (oversized) return oversized;

  const { userId, otp } = await req.json();
  if (!userId || !otp) return NextResponse.json({ error: "User ID and OTP are required" }, { status: 400 });

  // Identifier here is the (possibly opaque/fake) userId itself — same
  // reasoning as forgot-password's response shape: this must behave
  // identically for real and fake ids, and it does, since the budget is
  // keyed on the string value alone.
  const limited = await enforceRateLimit(req, "OTP_VERIFY", userId);
  if (limited) return limited;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return GENERIC_OTP_FAILURE;

  const result = await verifyOTP(userId, "FORGOT_PASSWORD", otp);
  if (!result.success) return NextResponse.json({ error: "Invalid or expired OTP" }, { status: 400 });

  // Issue a short-lived reset token (10 min)
  const resetToken = crypto.randomBytes(32).toString("hex");
  const resetTokenExpiry = new Date(Date.now() + 10 * 60 * 1000);

  // Clean up any prior reset tokens for this user, then create fresh one
  await prisma.verificationToken.deleteMany({
    where: { identifier: `password-reset:${userId}` },
  });
  await prisma.verificationToken.create({
    data: {
      identifier: `password-reset:${userId}`,
      token: resetToken,
      expires: resetTokenExpiry,
    },
  });

  return NextResponse.json({ resetToken, userId, expires: 10 });
}
