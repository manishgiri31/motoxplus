import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createOTP } from "@/lib/auth/otp";
import { sendEmail, verifyEmailTemplate, welcomeTemplate } from "@/lib/email";
import { checkIPRateLimit } from "@/lib/auth/rate-limit";
import { getClientIP } from "@/lib/auth/middleware";

export async function POST(req: NextRequest) {
  const ip = getClientIP(req);
  if (!checkIPRateLimit(ip, 5, 60)) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  const body = await req.json();
  const { name, email, password, companyName, gstNumber, ownerName, phone, state, city, address, pincode } = body;

  if (!name || !email || !password) {
    return NextResponse.json({ error: "Name, email and password are required" }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) return NextResponse.json({ error: "Email already registered" }, { status: 409 });

  const hashed = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      name,
      email: email.toLowerCase(),
      password: hashed,
      role: "DEALER",
      ...(companyName && gstNumber && ownerName && phone && state && city && address && pincode
        ? {
            dealer: {
              create: { companyName, gstNumber: gstNumber.toUpperCase(), ownerName, phone, state, city, address, pincode },
            },
          }
        : {}),
    },
  });

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
