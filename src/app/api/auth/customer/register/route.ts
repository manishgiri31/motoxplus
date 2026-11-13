import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { normalizeIndianMobile } from "@/lib/phone";
import { createOTP, checkOTP, claimOTP, checkResendLimit } from "@/lib/auth/otp";
import { deliverOtp } from "@/lib/auth/otp-delivery";
import { establishWebSession, setWebSessionCookies } from "@/lib/auth/web-session";
import { getClientIP, getDeviceInfo } from "@/lib/auth/middleware";
import { enforceRateLimit, rejectOversizedBody, JSON_BODY_MAX_BYTES } from "@/lib/auth/rate-limit-budgets";
import { signupDetailsSchema, fieldErrors, maskEmail } from "@/lib/customer/signup";

// B2C customer signup — /signup. Three actions on one route:
//
//   start   name + mobile + email + delivery address. Creates (or refreshes) a
//           *pending* customer and sends two codes: WhatsApp to the mobile
//           (MOBILE_VERIFICATION) and email (EMAIL_VERIFICATION).
//   verify  both codes in one request. Both are checked first and consumed
//           only if both are right, so the account is either fully verified
//           and signed in, or untouched. No half-verified session exists.
//   resend  a fresh code on one channel for a pending signup.
//
// "Pending" = role CUSTOMER and mobile not yet verified. Any other account on
// that number (a verified customer, a dealer, a vendor...) is told to sign in
// instead; one phone stays one account. Returning customers sign in with the
// phone-only code on /login (/api/auth/login-otp), unchanged.

const startSchema = signupDetailsSchema.extend({ action: z.literal("start") });
const verifySchema = z.object({
  action: z.literal("verify"),
  phone: z.string(),
  phoneOtp: z.string().regex(/^\d{6}$/),
  emailOtp: z.string().regex(/^\d{6}$/),
});
const resendSchema = z.object({
  action: z.literal("resend"),
  phone: z.string(),
  channel: z.enum(["phone", "email"]),
});

const accountExists = () =>
  NextResponse.json(
    { error: "This mobile number already has an account. Sign in instead.", code: "ACCOUNT_EXISTS" },
    { status: 409 }
  );

function isPendingSignup(user: { role: string; mobileVerified: boolean }) {
  return user.role === "CUSTOMER" && !user.mobileVerified;
}

export async function POST(req: NextRequest) {
  const oversized = rejectOversizedBody(req, JSON_BODY_MAX_BYTES);
  if (oversized) return oversized;

  const body = await req.json().catch(() => null);
  const action = body && typeof body === "object" ? (body as { action?: unknown }).action : undefined;

  if (action === "verify") return verify(req, body);
  if (action === "resend") return resend(req, body);
  return start(req, { ...body, action: "start" });
}

async function start(req: NextRequest, body: unknown) {
  const parsed = startSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Check the highlighted fields", fields: fieldErrors(parsed.error) }, { status: 400 });
  }
  const { name, email, address, city, state, pincode } = parsed.data;
  const mobile = normalizeIndianMobile(parsed.data.phone)!;

  const limited = await enforceRateLimit(req, "OTP_SEND", mobile);
  if (limited) return limited;

  const existing = await prisma.user.findUnique({ where: { mobileNumber: mobile } });
  if (existing && !isPendingSignup(existing)) return accountExists();

  const emailOwner = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (emailOwner && emailOwner.id !== existing?.id) {
    return NextResponse.json(
      { error: "This email is already used by another account", fields: { email: "This email is already used by another account" } },
      { status: 409 }
    );
  }

  const delivery = { deliveryAddress: address, deliveryCity: city, deliveryState: state, deliveryPincode: pincode };

  // A pending signup that was abandoned (wrong email typed, codes expired)
  // is simply overwritten. Nothing about it was ever verified or signed in.
  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: {
          name,
          email,
          emailVerified: null,
          emailVerifiedAt: null,
          customer: { upsert: { create: delivery, update: delivery } },
        },
      })
    : await prisma.user.create({
        data: {
          name,
          email,
          mobileNumber: mobile,
          role: "CUSTOMER",
          customerType: "B2C",
          isActive: true,
          customer: { create: delivery },
        },
      });

  if (!(await checkResendLimit(user.id, "MOBILE_VERIFICATION"))) {
    return NextResponse.json({ error: "Too many code requests. Try again in an hour." }, { status: 429 });
  }

  const [phoneCode, emailCode] = await Promise.all([
    createOTP(user.id, "MOBILE_VERIFICATION"),
    createOTP(user.id, "EMAIL_VERIFICATION"),
  ]);
  const [phoneSent, emailSent] = await Promise.all([
    deliverOtp({ channel: "WHATSAPP", destination: mobile, code: phoneCode, purpose: "MOBILE_VERIFICATION", name }),
    deliverOtp({ channel: "EMAIL", destination: email, code: emailCode, purpose: "EMAIL_VERIFICATION", name }),
  ]);
  if (!phoneSent.delivered) {
    return NextResponse.json({ error: "Couldn't send the WhatsApp code. Check the number and try again." }, { status: 502 });
  }

  return NextResponse.json({
    phone: mobile,
    maskedEmail: maskEmail(email),
    // The form still moves on; the customer can resend the email code from there.
    emailDelivered: emailSent.delivered,
  });
}

async function verify(req: NextRequest, body: unknown) {
  const parsed = verifySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Enter both 6-digit codes" }, { status: 400 });

  const mobile = normalizeIndianMobile(parsed.data.phone);
  if (!mobile) return NextResponse.json({ error: "Invalid mobile number" }, { status: 400 });

  const limited = await enforceRateLimit(req, "OTP_VERIFY", mobile);
  if (limited) return limited;

  const user = await prisma.user.findUnique({
    where: { mobileNumber: mobile },
    include: { dealer: true, vendor: true, admin: true, customer: true },
  });
  if (!user || !isPendingSignup(user) || !user.isActive) {
    return NextResponse.json({ error: "This signup has expired. Start again." }, { status: 400 });
  }

  // Both checked (wrong guesses still count toward each code's attempt cap)
  // before either is consumed.
  const [phone, email] = await Promise.all([
    checkOTP(user.id, "MOBILE_VERIFICATION", parsed.data.phoneOtp),
    checkOTP(user.id, "EMAIL_VERIFICATION", parsed.data.emailOtp),
  ]);
  if (!phone.success || !email.success) {
    return NextResponse.json(
      {
        error: "One or both codes are incorrect",
        fields: {
          ...(phone.success ? {} : { phoneOtp: phone.error }),
          ...(email.success ? {} : { emailOtp: email.error }),
        },
      },
      { status: 400 }
    );
  }
  const [phoneClaimed, emailClaimed] = await Promise.all([claimOTP(phone.otpId), claimOTP(email.otpId)]);
  if (!phoneClaimed || !emailClaimed) {
    return NextResponse.json({ error: "These codes were already used. Request new ones." }, { status: 400 });
  }

  const now = new Date();
  const verified = await prisma.user.update({
    where: { id: user.id },
    data: { mobileVerified: true, mobileVerifiedAt: now, emailVerified: now, emailVerifiedAt: now, lastLogin: now },
    include: { dealer: true, vendor: true, admin: true, customer: true },
  });

  const session = await establishWebSession(verified, {
    ipAddress: getClientIP(req),
    userAgent: req.headers.get("user-agent") || undefined,
    deviceInfo: getDeviceInfo(req),
  });
  const res = NextResponse.json({ user: { id: verified.id, name: verified.name, role: verified.role } });
  setWebSessionCookies(res, session);
  return res;
}

async function resend(req: NextRequest, body: unknown) {
  const parsed = resendSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const mobile = normalizeIndianMobile(parsed.data.phone);
  if (!mobile) return NextResponse.json({ error: "Invalid mobile number" }, { status: 400 });

  const isPhone = parsed.data.channel === "phone";
  const limited = await enforceRateLimit(req, isPhone ? "OTP_SEND" : "OTP_SEND_EMAIL", mobile);
  if (limited) return limited;

  const user = await prisma.user.findUnique({ where: { mobileNumber: mobile } });
  if (!user || !isPendingSignup(user)) {
    return NextResponse.json({ error: "This signup has expired. Start again." }, { status: 400 });
  }

  const type = isPhone ? "MOBILE_VERIFICATION" : "EMAIL_VERIFICATION";
  if (!(await checkResendLimit(user.id, type))) {
    return NextResponse.json({ error: "Too many code requests. Try again in an hour." }, { status: 429 });
  }

  const code = await createOTP(user.id, type);
  const sent = await deliverOtp({
    channel: isPhone ? "WHATSAPP" : "EMAIL",
    destination: isPhone ? mobile : user.email,
    code,
    purpose: type,
    name: user.name ?? undefined,
  });
  if (!sent.delivered) return NextResponse.json({ error: sent.error }, { status: 502 });
  return NextResponse.json({ message: "Code sent" });
}
