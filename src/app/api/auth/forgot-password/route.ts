import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createOTP, checkResendLimit } from "@/lib/auth/otp";
import { sendEmail, passwordResetTemplate } from "@/lib/email";
import { sendOTP } from "@/lib/sms";
import { checkIPRateLimit } from "@/lib/auth/rate-limit";
import { getClientIP } from "@/lib/auth/middleware";
import { normalizeIndianMobile } from "@/lib/phone";

const GENERIC_MESSAGE = "If this account exists, an OTP has been sent.";

export async function POST(req: NextRequest) {
  const ip = getClientIP(req);
  if (!(await checkIPRateLimit(ip, 5, 60))) {
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }

  const { email, mobile, method } = await req.json();

  // method: "email" | "mobile"
  let user;
  if (method === "mobile" && mobile) {
    const normalizedMobile = normalizeIndianMobile(mobile);
    user = normalizedMobile ? await prisma.user.findUnique({ where: { mobileNumber: normalizedMobile } }) : null;
  } else if (email) {
    user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  } else {
    return NextResponse.json({ error: "Email or mobile number required" }, { status: 400 });
  }

  // Same message, same shape, whether or not the account exists — the
  // previous code returned a *different* message ("OTP sent successfully")
  // and echoed back the real userId only when the account existed, which
  // let anyone probe arbitrary emails/phone numbers for registered accounts
  // despite the comment's stated intent to prevent that.
  if (!user || !user.isActive) {
    return NextResponse.json({ message: GENERIC_MESSAGE, userId: null });
  }

  const canSend = await checkResendLimit(user.id, "FORGOT_PASSWORD");
  if (!canSend) return NextResponse.json({ error: "Too many requests. Try again in 1 hour." }, { status: 429 });

  const code = await createOTP(user.id, "FORGOT_PASSWORD");

  if (method === "mobile" && user.mobileNumber) {
    await sendOTP(user.mobileNumber, code).catch(console.error);
  } else {
    await sendEmail({
      to: user.email,
      subject: "Password Reset OTP — MOTOXPLUS",
      html: passwordResetTemplate(user.name || "", code),
    }).catch(console.error);
  }

  return NextResponse.json({
    message: GENERIC_MESSAGE,
    userId: user.id,
    method: method === "mobile" ? "mobile" : "email",
    expires: 10,
  });
}
