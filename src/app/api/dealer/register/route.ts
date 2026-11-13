import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { createOTP } from "@/lib/auth/otp";
import { sendEmail, verifyEmailTemplate, welcomeTemplate } from "@/lib/email";
import { encrypt } from "@/lib/crypto/encryption";
import { checkIPRateLimit } from "@/lib/auth/rate-limit";
import { getClientIP } from "@/lib/auth/middleware";
import { normalizeIndianMobile } from "@/lib/phone";
import { checkDealerGstin } from "@/lib/gst/dealer-gstin";
import { getCurrentUserId } from "@/lib/auth/current-user";

const registerSchema = z.object({
  companyName: z.string().min(2),
  ownerName: z.string().min(2),
  phone: z.string().min(10),
  email: z.string().email(),
  password: z.string().min(8),
  state: z.string().min(2),
  city: z.string().min(2),
  // Dealer = B2B: GSTIN mandatory; checksum + live registry check below.
  gstNumber: z.string().trim().max(20).optional().or(z.literal("")),
  panNumber: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/).optional().or(z.literal("")),
  aadhaarNumber: z.string().regex(/^[0-9]{12}$/).optional().or(z.literal("")),
  companyAddress: z.string().optional().or(z.literal("")),
  shopAddress: z.string().optional().or(z.literal("")),
  pincode: z.string().regex(/^[0-9]{6}$/).optional().or(z.literal("")),
});

/**
 * One login, several profiles (lib/auth/workspaces.ts): a signed-in vendor adds a dealer profile to the SAME account.
 * Only the business fields are taken; name, mobile, email, password and verification are the account's own.
 * The active workspace is switched afterwards by /api/auth/switch-workspace.
 */
const attachSchema = registerSchema.pick({
  companyName: true,
  state: true,
  city: true,
  gstNumber: true,
  panNumber: true,
  companyAddress: true,
  shopAddress: true,
  pincode: true,
});

async function attachDealerProfile(req: NextRequest, body: unknown) {
  const userId = await getCurrentUserId(req);
  if (!userId) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { dealer: true } });
  if (!user || !user.isActive) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  if (user.dealer) return NextResponse.json({ success: true, userId: user.id, dealerId: user.dealer.id, existing: true });
  if (user.role !== "VENDOR") {
    return NextResponse.json({ error: "Only a vendor account can add a dealer profile this way" }, { status: 403 });
  }

  const data = attachSchema.parse(body);
  const gstNumber = (data.gstNumber ?? "").replace(/\s/g, "").toUpperCase();
  if (gstNumber && (await prisma.dealer.findUnique({ where: { gstNumber } }))) {
    return NextResponse.json({ error: "GST number already registered" }, { status: 400 });
  }
  const gst = await checkDealerGstin(gstNumber);
  if (!gst.ok) return NextResponse.json({ error: gst.error }, { status: gst.status });

  const dealer = await prisma.dealer.create({
    data: {
      userId: user.id,
      companyName: data.companyName,
      ...gst.dealerFields,
      panNumber: data.panNumber || null,
      ownerName: user.name || data.companyName,
      phone: user.mobileNumber || "",
      state: data.state,
      city: data.city,
      address: data.shopAddress || data.companyAddress || null,
      companyAddress: data.companyAddress || null,
      shopAddress: data.shopAddress || null,
      pincode: data.pincode || null,
      status: "ACTIVE",
    },
  });
  return NextResponse.json({ success: true, userId: user.id, dealerId: dealer.id });
}

export async function POST(req: NextRequest) {
  const ip = getClientIP(req);
  if (!(await checkIPRateLimit(ip, 5, 60))) {
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }

  try {
    const body = await req.json();
    if (body && typeof body === "object" && (body as { attach?: unknown }).attach === true) {
      return await attachDealerProfile(req, body);
    }
    const data = registerSchema.parse(body);

    const normalizedMobile = normalizeIndianMobile(data.phone);
    if (!normalizedMobile) {
      return NextResponse.json({ error: "Invalid Indian mobile number" }, { status: 400 });
    }

    const [existingUser, existingMobile] = await Promise.all([
      prisma.user.findUnique({ where: { email: data.email.toLowerCase() } }),
      prisma.user.findUnique({ where: { mobileNumber: normalizedMobile } }),
    ]);
    // Same wording as before, plus the way in: one account can hold a dealer and a vendor profile.
    if (existingUser) {
      return NextResponse.json({ error: "Email already registered", code: "ACCOUNT_EXISTS" }, { status: 400 });
    }
    if (existingMobile) {
      return NextResponse.json({ error: "Mobile number already registered", code: "ACCOUNT_EXISTS" }, { status: 400 });
    }

    const gstNumber = (data.gstNumber ?? "").replace(/\s/g, "").toUpperCase();
    if (gstNumber) {
      const existingGST = await prisma.dealer.findUnique({ where: { gstNumber } });
      if (existingGST) {
        return NextResponse.json({ error: "GST number already registered" }, { status: 400 });
      }
    }

    const gst = await checkDealerGstin(gstNumber);
    if (!gst.ok) return NextResponse.json({ error: gst.error }, { status: gst.status });

    const hashedPassword = await bcrypt.hash(data.password, 12);

    const user = await prisma.user.create({
      data: {
        name: data.ownerName,
        email: data.email.toLowerCase(),
        password: hashedPassword,
        role: "DEALER",
        customerType: "B2B",
        mobileNumber: normalizedMobile,
        dealer: {
          create: {
            companyName: data.companyName,
            ...gst.dealerFields,
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
            // No admin approval step — a verified dealer is active immediately.
            status: "ACTIVE",
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
