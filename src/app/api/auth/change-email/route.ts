import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { createOTP } from "@/lib/auth/otp";
import { sendEmail, verifyEmailTemplate } from "@/lib/email";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { checkIPRateLimit } from "@/lib/auth/rate-limit";
import { getClientIP } from "@/lib/auth/middleware";

const bodySchema = z.object({ newEmail: z.string().email() });

export async function POST(req: NextRequest) {
  const ip = getClientIP(req);
  if (!checkIPRateLimit(ip, 5, 60)) {
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }

  const userId = await getCurrentUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "A valid email address is required" }, { status: 400 });

  const newEmail = parsed.data.newEmail.toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email: newEmail } });
  if (existing && existing.id !== userId) {
    return NextResponse.json({ error: "Email already registered to another account" }, { status: 409 });
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: { email: newEmail, emailVerified: null, emailVerifiedAt: null },
  });

  const otp = await createOTP(user.id, "EMAIL_VERIFICATION");
  const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL}/verify-email?userId=${user.id}`;

  await sendEmail({
    to: user.email,
    subject: "Verify your new email — MOTOXPLUS",
    html: verifyEmailTemplate(user.name || "", verificationUrl, otp),
  }).catch((err) => console.error("[ChangeEmail] Failed to send verification email:", err));

  return NextResponse.json({ message: "Email updated. Please verify your new email address.", userId: user.id });
}
