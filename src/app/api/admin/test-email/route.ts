import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { checkIPRateLimit } from "@/lib/auth/rate-limit";
import { getClientIP } from "@/lib/auth/middleware";

const bodySchema = z.object({
  to: z.string().email(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const ip = getClientIP(req);
  if (!checkIPRateLimit(ip, 5, 60)) {
    return NextResponse.json({ success: false, error: "Too many requests. Try again later." }, { status: 429 });
  }

  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
    const missing = [
      !process.env.RESEND_API_KEY && "RESEND_API_KEY",
      !process.env.EMAIL_FROM && "EMAIL_FROM",
    ].filter(Boolean).join(", ");
    console.error(`[TestEmail] Cannot send — missing env var(s): ${missing}`);
    return NextResponse.json(
      { success: false, error: `Server is missing required email configuration: ${missing}` },
      { status: 500 }
    );
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "A valid 'to' email address is required" }, { status: 400 });
  }

  const { to } = parsed.data;

  try {
    const result = await sendEmail({
      to,
      subject: "MOTOXPLUS — Resend Test Email",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #111;">Resend Integration Test</h2>
          <p>This is a test email confirming that the Resend integration for <strong>MOTOXPLUS India Pvt. Ltd.</strong> is working correctly.</p>
          <p style="color: #666; font-size: 13px;">Sent at ${new Date().toISOString()}</p>
        </div>
      `,
    });

    if (result.skipped) {
      return NextResponse.json(
        { success: false, error: "Email sending is disabled — missing configuration" },
        { status: 500 }
      );
    }

    console.log(`[TestEmail] Sent successfully to ${to} — id: ${result.id}`);
    return NextResponse.json({ success: true, id: result.id, message: `Test email sent to ${to}` });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error while sending email";
    console.error(`[TestEmail] Failed to send to ${to}:`, err);
    return NextResponse.json({ success: false, error: message }, { status: 502 });
  }
}
