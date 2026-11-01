import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createOTP } from "@/lib/auth/otp";
import { sendEmail, verifyEmailTemplate, welcomeTemplate } from "@/lib/email";
import { encrypt } from "@/lib/crypto/encryption";
import { checkIPRateLimit } from "@/lib/auth/rate-limit";
import { rejectOversizedBody, JSON_BODY_MAX_BYTES } from "@/lib/auth/rate-limit-budgets";
import { validateNewPassword } from "@/lib/auth/password-policy";
import { getClientIP } from "@/lib/auth/middleware";
import { normalizeIndianMobile } from "@/lib/phone";
import { Prisma } from "@prisma/client";

const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const AADHAAR_REGEX = /^[0-9]{12}$/;
const PINCODE_REGEX = /^[1-9][0-9]{5}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Every free-text field is a string by the time it reaches Prisma/bcrypt/
// encrypt — `await req.json()` hands back whatever JSON the caller sent, so
// an object/array/number in `name` or `gstNumber` used to reach `.toUpperCase()`
// and 500 (or worse, get stored). Anything non-string is treated as absent.
function str(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(req: NextRequest) {
  const ip = getClientIP(req);
  if (!(await checkIPRateLimit(ip, 5, 60))) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  const oversized = rejectOversizedBody(req, JSON_BODY_MAX_BYTES);
  if (oversized) return oversized;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const name = str(body.name, 100);
  const email = str(body.email, 254).toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";
  const companyName = str(body.companyName, 150);
  const gstNumber = str(body.gstNumber, 15).toUpperCase();
  const panNumber = str(body.panNumber, 10).toUpperCase();
  const aadhaarNumber = str(body.aadhaarNumber, 12);
  const ownerName = str(body.ownerName, 100);
  const phone = str(body.phone, 20);
  const state = str(body.state, 60);
  const city = str(body.city, 80);
  const address = str(body.address, 300);
  const pincode = str(body.pincode, 6);

  if (!name || !email || !password) {
    return NextResponse.json({ error: "Name, email and password are required" }, { status: 400 });
  }

  if (gstNumber && !GST_REGEX.test(gstNumber)) {
    return NextResponse.json({ error: "Invalid GST number" }, { status: 400 });
  }
  if (panNumber && !PAN_REGEX.test(panNumber)) {
    return NextResponse.json({ error: "Invalid PAN number" }, { status: 400 });
  }
  if (aadhaarNumber && !AADHAAR_REGEX.test(aadhaarNumber)) {
    return NextResponse.json({ error: "Invalid Aadhaar number" }, { status: 400 });
  }
  if (pincode && !PINCODE_REGEX.test(pincode)) {
    return NextResponse.json({ error: "Invalid pincode" }, { status: 400 });
  }

  let normalizedMobile: string | undefined;
  if (phone) {
    const normalized = normalizeIndianMobile(phone);
    if (!normalized) {
      return NextResponse.json({ error: "Invalid Indian mobile number" }, { status: 400 });
    }
    normalizedMobile = normalized;
  }

  const passwordError = validateNewPassword(password, { email, name });
  if (passwordError) {
    return NextResponse.json({ error: passwordError }, { status: 400 });
  }

  if (!EMAIL_REGEX.test(email)) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return NextResponse.json({ error: "Email already registered" }, { status: 409 });

  if (gstNumber) {
    const existingGST = await prisma.dealer.findUnique({ where: { gstNumber } });
    if (existingGST) return NextResponse.json({ error: "GST number already registered" }, { status: 409 });
  }

  if (normalizedMobile) {
    const existingMobile = await prisma.user.findUnique({ where: { mobileNumber: normalizedMobile } });
    if (existingMobile) return NextResponse.json({ error: "Mobile number already registered" }, { status: 409 });
  }

  const hashed = await bcrypt.hash(password, 12);

  let user;
  try {
    user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashed,
        role: "DEALER",
        mobileNumber: normalizedMobile,
        ...(companyName && ownerName && phone && state && city
          ? {
              dealer: {
                create: {
                  companyName,
                  gstNumber: gstNumber || null,
                  panNumber: panNumber || null,
                  aadhaarNumber: aadhaarNumber ? encrypt(aadhaarNumber) : null,
                  ownerName,
                  phone: normalizedMobile || phone,
                  state,
                  city,
                  address: address || null,
                  pincode: pincode || null,
                  // No admin approval step — a verified dealer is active immediately.
                  status: "ACTIVE",
                },
              },
            }
          : {}),
      },
    });
  } catch (err) {
    // The pre-checks above (lines 56-67) narrow the common case, but can't
    // close a race between two concurrent registrations for the same
    // email/mobile/GST — this catches that at the DB constraint instead of
    // letting it surface as an unhandled 500.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const fields = (err.meta?.target as string[]) ?? [];
      const field = fields.includes("mobileNumber")
        ? "Mobile number"
        : fields.includes("email")
          ? "Email"
          : fields.includes("gstNumber")
            ? "GST number"
            : "Value";
      return NextResponse.json({ error: `${field} already registered` }, { status: 409 });
    }
    throw err;
  }

  // Send verification email
  const otp = await createOTP(user.id, "EMAIL_VERIFICATION");
  const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL}/verify-email?userId=${user.id}`;

  await sendEmail({
    to: user.email,
    subject: "Verify your email — MOTOXPLUS",
    html: verifyEmailTemplate(user.name || "", verificationUrl, otp),
  }).catch(console.error);

  await sendEmail({
    to: user.email,
    subject: "Welcome to MOTOXPLUS India",
    html: welcomeTemplate(user.name || "", user.email),
  }).catch(console.error);

  return NextResponse.json({
    message: "Registration successful. Please verify your email.",
    userId: user.id,
    email: user.email,
  }, { status: 201 });
}
