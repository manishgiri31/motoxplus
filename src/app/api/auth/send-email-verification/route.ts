import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createOTP, checkResendLimit } from "@/lib/auth/otp";
import { sendEmail, verifyEmailTemplate } from "@/lib/email";
import { checkIPRateLimit } from "@/lib/auth/rate-limit";
import { getClientIP } from "@/lib/auth/middleware";

export async function POST(req: NextRequest) {
  const ip = getClientIP(req);
  if (!(await checkIPRateLimit(ip, 5, 60))) {
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }

  const { email, userId } = await req.json();

  let user;
  if (userId) {
    user = await prisma.user.findUnique({ where: { id: userId } });
  } else if (email) {
    user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  }

  // Generic response regardless of outcome: this endpoint is unauthenticated
  // (anyone can call it with any userId/email), so distinguishing "not found"
  // vs "already verified" vs "sent" would let a caller enumerate registered
  // emails and repeatedly email-bomb arbitrary third parties with a
  // distinguishable oracle. The resend-limit check below still caps actual
  // sends per account.
  const GENERIC_OK = NextResponse.json({ message: "If this account exists and is unverified, a verification email has been sent.", expires: 10 });

  if (!user || user.emailVerified) return GENERIC_OK;

  const canResend = await checkResendLimit(user.id, "EMAIL_VERIFICATION");
  if (!canResend) return GENERIC_OK;

  const otp = await createOTP(user.id, "EMAIL_VERIFICATION");
  const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL}/verify-email?userId=${user.id}`;

  await sendEmail({
    to: user.email,
    subject: "Verify your email — MOTOXPLUS",
    html: verifyEmailTemplate(user.name || "", verificationUrl, otp),
  }).catch(console.error);

  return GENERIC_OK;
}
