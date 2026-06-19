import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createOTP, checkResendLimit } from "@/lib/auth/otp";
import { sendEmail, verifyEmailTemplate } from "@/lib/email";
import { checkIPRateLimit } from "@/lib/auth/rate-limit";
import { getClientIP } from "@/lib/auth/middleware";

export async function POST(req: NextRequest) {
  const ip = getClientIP(req);
  if (!checkIPRateLimit(ip, 5, 60)) {
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }

  const { email, userId } = await req.json();

  let user;
  if (userId) {
    user = await prisma.user.findUnique({ where: { id: userId } });
  } else if (email) {
    user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  }

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (user.emailVerified) return NextResponse.json({ error: "Email already verified" }, { status: 400 });

  const canResend = await checkResendLimit(user.id, "EMAIL_VERIFICATION");
  if (!canResend) return NextResponse.json({ error: "Too many resend attempts. Try again in 1 hour." }, { status: 429 });

  const otp = await createOTP(user.id, "EMAIL_VERIFICATION");
  const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL}/verify-email?userId=${user.id}`;

  await sendEmail({
    to: user.email,
    subject: "Verify your email — MOTOXPLUS",
    html: verifyEmailTemplate(user.name || "", verificationUrl, otp),
  });

  return NextResponse.json({ message: "Verification email sent", expires: 10 });
}
