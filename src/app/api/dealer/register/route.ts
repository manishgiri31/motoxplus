import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { createOTP } from "@/lib/auth/otp";
import { sendEmail, verifyEmailTemplate, welcomeTemplate } from "@/lib/email";
import { encrypt } from "@/lib/crypto/encryption";
import { checkIPRateLimit } from "@/lib/auth/rate-limit";
import { getClientIP } from "@/lib/auth/middleware";

const registerSchema = z.object({
  companyName: z.string().min(2),
  ownerName: z.string().min(2),
  phone: z.string().min(10),
  email: z.string().email(),
  password: z.string().min(8),
  state: z.string().min(2),
  city: z.string().min(2),
  gstNumber: z.string().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/).optional().or(z.literal("")),
  panNumber: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/).optional().or(z.literal("")),
  aadhaarNumber: z.string().regex(/^[0-9]{12}$/).optional().or(z.literal("")),
  companyAddress: z.string().optional().or(z.literal("")),
  shopAddress: z.string().optional().or(z.literal("")),
  pincode: z.string().regex(/^[0-9]{6}$/).optional().or(z.literal("")),
});

export async function POST(req: NextRequest) {
  const ip = getClientIP(req);
  if (!checkIPRateLimit(ip, 5, 60)) {
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }

  try {
    const body = await req.json();
    const data = registerSchema.parse(body);

    const normalizedMobile = data.phone.replace(/\s/g, "").replace("+91", "");
    if (!/^[6-9]\d{9}$/.test(normalizedMobile)) {
      return NextResponse.json({ error: "Invalid Indian mobile number" }, { status: 400 });
    }

    const [existingUser, existingMobile] = await Promise.all([
      prisma.user.findUnique({ where: { email: data.email.toLowerCase() } }),
      prisma.user.findUnique({ where: { mobileNumber: normalizedMobile } }),
    ]);
    if (existingUser) {
      return NextResponse.json({ error: "Email already registered" }, { status: 400 });
    }
    if (existingMobile) {
      return NextResponse.json({ error: "Mobile number already registered" }, { status: 400 });
    }

    if (data.gstNumber) {
      const existingGST = await prisma.dealer.findUnique({ where: { gstNumber: data.gstNumber } });
      if (existingGST) {
        return NextResponse.json({ error: "GST number already registered" }, { status: 400 });
      }
    }

    const hashedPassword = await bcrypt.hash(data.password, 12);

    const user = await prisma.user.create({
      data: {
        name: data.ownerName,
        email: data.email.toLowerCase(),
        password: hashedPassword,
        role: "DEALER",
        mobileNumber: normalizedMobile,
        dealer: {
          create: {
            companyName: data.companyName,
            gstNumber: data.gstNumber || null,
            panNumber: data.panNumber || null,
            aadhaarNumber: data.aadhaarNumber ? encrypt(data.aadhaarNumber) : null,
            ownerName: data.ownerName,
            phone: normalizedMobile,
            state: data.state,
            city: data.city,
            // Legacy single-address field, kept in sync for existing invoice/shipment code
            address: data.shopAddress || data.companyAddress || null,
            companyAddress: data.companyAddress || null,
            shopAddress: data.shopAddress || null,
            pincode: data.pincode || null,
            status: "PENDING",
          },
        },
      },
    });

    const otp = await createOTP(user.id, "EMAIL_VERIFICATION");
    const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL}/verify-email?userId=${user.id}`;

    await sendEmail({
      to: user.email,
      subject: "Verify your email — MOTOXPLUS",
      html: verifyEmailTemplate(user.name || "", verificationUrl, otp),
    }).catch((err) => console.error("[DealerRegister] Failed to send verification email:", err));

    await sendEmail({
      to: user.email,
      subject: "Welcome to MOTOXPLUS India",
      html: welcomeTemplate(user.name || "", user.email),
    }).catch((err) => console.error("[DealerRegister] Failed to send welcome email:", err));

    return NextResponse.json({ success: true, userId: user.id, email: user.email });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid form data" },
        { status: 400 }
      );
    }
    console.error("Dealer registration error:", error);
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
