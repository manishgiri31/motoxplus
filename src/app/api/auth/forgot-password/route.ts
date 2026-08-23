import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { createOTP, checkResendLimit, OTP_EXPIRY_MINUTES } from "@/lib/auth/otp";
import { sendEmail, passwordResetTemplate } from "@/lib/email";
import { sendOTP } from "@/lib/sms";
import { enforceRateLimit, rejectOversizedBody, JSON_BODY_MAX_BYTES } from "@/lib/auth/rate-limit-budgets";
import { normalizeIndianMobile } from "@/lib/phone";

const GENERIC_MESSAGE = "If this account exists, an OTP has been sent.";

// A same-shaped, same-length placeholder for the non-existent-account branch.
// Returning `userId: null` (and omitting method/expires) previously made the
// response distinguishable by shape alone even though the message text was
// unified — a shorter payload / null id is just as much an oracle as a
// different message. verify-forgot-password-otp treats any id that doesn't
// resolve to a real user as an opaque "invalid OTP" failure (see that route),
// so this value never needs to correspond to anything real.
function opaqueFlowId(): string {
  return "c" + crypto.randomBytes(12).toString("hex");
}

export async function POST(req: NextRequest) {
  const oversized = rejectOversizedBody(req, JSON_BODY_MAX_BYTES);
  if (oversized) return oversized;

  const { email, mobile, method } = await req.json();

  // method: "email" | "mobile" — identifier for the per-identifier OTP_SEND
  // budget below is whichever of these two the request is actually keyed on.
  let user;
  let rateLimitIdentifier: string | undefined;
  if (method === "mobile" && mobile) {
    const normalizedMobile = normalizeIndianMobile(mobile);
    rateLimitIdentifier = normalizedMobile ?? undefined;
    user = normalizedMobile ? await prisma.user.findUnique({ where: { mobileNumber: normalizedMobile } }) : null;
  } else if (email) {
    rateLimitIdentifier = String(email).toLowerCase();
    user = await prisma.user.findUnique({ where: { email: rateLimitIdentifier } });
  } else {
    return NextResponse.json({ error: "Email or mobile number required" }, { status: 400 });
  }

  const isMobileMethod = method === "mobile" && !!mobile;
  const limited = await enforceRateLimit(req, isMobileMethod ? "OTP_SEND" : "OTP_SEND_EMAIL", rateLimitIdentifier);
  if (limited) return limited;

  // Same message, same shape, whether or not the account exists.
  if (!user || !user.isActive) {
    return NextResponse.json({
      message: GENERIC_MESSAGE,
      userId: opaqueFlowId(),
      method: method === "mobile" ? "mobile" : "email",
      expires: OTP_EXPIRY_MINUTES,
    });
  }

  // SMS costs real money so stays capped; email is free to send so has no
  // per-account hourly cap (isOtpLocked's brute-force lockout still applies).
  const canSend = await checkResendLimit(user.id, "FORGOT_PASSWORD", isMobileMethod ? undefined : Infinity);
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
    expires: OTP_EXPIRY_MINUTES,
  });
}
