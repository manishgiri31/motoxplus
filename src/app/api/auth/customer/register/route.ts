import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { normalizeIndianMobile, placeholderEmailForMobile } from "@/lib/phone";
import { createOTP, checkResendLimit } from "@/lib/auth/otp";
import { deliverOtp } from "@/lib/auth/otp-delivery";
import { enforceRateLimit, rejectOversizedBody, JSON_BODY_MAX_BYTES } from "@/lib/auth/rate-limit-budgets";

const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  phone: z.string().min(10),
  email: z.string().email().optional().or(z.literal("")),
});

// Same generic response whichever branch runs below (new signup vs. an
// already-registered number) — a caller can't tell the two apart, matching
// login-otp's GENERIC_SENT enumeration-safety contract.
const GENERIC_SENT = { message: "An OTP has been sent to this mobile number." };

// B2C customer signup — B2C-EXPANSION-PLAN.md Phase 2. Only name + phone are
// required (email optional, no GSTIN, no approval step); reuses the existing
// LOGIN OTP type/delivery so /api/auth/login-otp's verify step (already
// generic-response, rate-limited, session-establishing) is the one and only
// place that turns a correct code into a session — this route only ever gets
// a User+Customer row into existence and sends the first code.
export async function POST(req: NextRequest) {
  const oversized = rejectOversizedBody(req, JSON_BODY_MAX_BYTES);
  if (oversized) return oversized;

  const body = await req.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid name and mobile number" }, { status: 400 });
  }

  const mobile = normalizeIndianMobile(parsed.data.phone);
  if (!mobile) {
    return NextResponse.json({ error: "Invalid Indian mobile number" }, { status: 400 });
  }

  const limited = await enforceRateLimit(req, "OTP_SEND", mobile);
  if (limited) return limited;

  // One phone, one role (brief: "Dealer aur customer dono ek hi phone se na
  // ban sakein"): User.mobileNumber is globally unique, so if this number
  // already belongs to anyone — dealer, vendor, or an existing customer — we
  // never create a second account. We just send that account a LOGIN OTP
  // instead, same generic response either way. A dealer typing their own
  // number into the customer signup form ends up logging into their existing
  // dealer account, not a new customer shell.
  const existing = await prisma.user.findUnique({ where: { mobileNumber: mobile } });

  let userId: string;
  if (existing) {
    if (!existing.isActive) return NextResponse.json(GENERIC_SENT);
    userId = existing.id;
  } else {
    const normalizedEmail = parsed.data.email ? parsed.data.email.toLowerCase() : null;
    if (normalizedEmail) {
      const emailTaken = await prisma.user.findUnique({ where: { email: normalizedEmail } });
      if (emailTaken) {
        return NextResponse.json({ error: "This email is already registered to another account" }, { status: 400 });
      }
    }

    const created = await prisma.user.create({
      data: {
        name: parsed.data.name,
        email: normalizedEmail ?? placeholderEmailForMobile(mobile),
        mobileNumber: mobile,
        role: "CUSTOMER",
        isActive: true,
        customer: { create: {} },
      },
    });
    userId = created.id;
  }

  const canResend = await checkResendLimit(userId, "LOGIN");
  if (!canResend) {
    return NextResponse.json({ error: "Too many OTP requests. Try again in 1 hour." }, { status: 429 });
  }

  const code = await createOTP(userId, "LOGIN");
  const result = await deliverOtp({ channel: "WHATSAPP", destination: mobile, code, purpose: "LOGIN", name: parsed.data.name });
  if (!result.delivered) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json(GENERIC_SENT);
}
