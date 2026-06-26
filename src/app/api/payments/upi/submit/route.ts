import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { baseTemplate } from "@/lib/email/templates/base";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "DEALER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { orderId, paymentMethod, utrNumber, payerName, payerEmail, payerPhone, screenshotUrl, screenshotKey } = body;

  // Validation
  if (!orderId) return NextResponse.json({ error: "Order ID is required." }, { status: 400 });
  if (!["UPI", "BANK_TRANSFER"].includes(paymentMethod)) {
    return NextResponse.json({ error: "Invalid payment method." }, { status: 400 });
  }
  if (!utrNumber || utrNumber.trim().length < 10) {
    return NextResponse.json({ error: "UTR/Reference number must be at least 10 characters." }, { status: 400 });
  }
  if (!payerName?.trim()) return NextResponse.json({ error: "Payer name is required." }, { status: 400 });
  if (!payerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payerEmail)) {
    return NextResponse.json({ error: "Valid email address is required." }, { status: 400 });
  }
  if (!payerPhone || !/^\d{10}$/.test(payerPhone.replace(/\D/g, ""))) {
    return NextResponse.json({ error: "Valid 10-digit phone number is required." }, { status: 400 });
  }
  if (!screenshotUrl || !screenshotKey) {
    return NextResponse.json({ error: "Payment screenshot is required." }, { status: 400 });
  }

  const dealer = await prisma.dealer.findUnique({ where: { userId: session.user.id } });
  if (!dealer) return NextResponse.json({ error: "Dealer not found." }, { status: 404 });

  const order = await prisma.order.findFirst({
    where: { id: orderId, dealerId: dealer.id },
  });
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });

  if (order.paymentStatus === "PAID") {
    return NextResponse.json({ error: "Payment already verified for this order." }, { status: 409 });
  }

  // Check for duplicate UTR
  const existing = await prisma.paymentSubmission.findUnique({
    where: { utrNumber: utrNumber.trim().toUpperCase() },
  });
  if (existing) {
    return NextResponse.json({ error: "This UTR number has already been submitted. Please check and try again." }, { status: 409 });
  }

  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || null;

  const submission = await prisma.paymentSubmission.create({
    data: {
      orderId: order.id,
      dealerId: dealer.id,
      paymentMethod: paymentMethod as "UPI" | "BANK_TRANSFER",
      utrNumber: utrNumber.trim().toUpperCase(),
      payerName: payerName.trim(),
      payerEmail: payerEmail.trim().toLowerCase(),
      payerPhone: payerPhone.replace(/\D/g, ""),
      screenshotUrl,
      screenshotKey,
      amount: order.amountDue,
      status: "SUBMITTED",
      ipAddress: ip,
    },
  });

  // Update order payment status to PARTIAL (awaiting verification)
  await prisma.order.update({
    where: { id: order.id },
    data: { paymentStatus: "PARTIAL" },
  });

  // Send confirmation email to dealer
  sendEmail({
    to: payerEmail,
    subject: `Payment Submitted — Order #${order.orderNumber} | MOTOXPLUS`,
    html: baseTemplate("Payment Submitted", `
      <div class="title">Payment Submitted for Verification</div>
      <p class="text">Hi ${payerName},</p>
      <p class="text">We have received your payment details for order <strong style="color:#fff;">#${order.orderNumber}</strong>. Our accounts team will verify the payment within 1-2 business hours.</p>
      <div class="otp-box" style="text-align:left;">
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="color:#6b7280;font-size:12px;padding:6px 0;">Order Number</td><td style="color:#fff;font-size:13px;font-weight:700;text-align:right;">#${order.orderNumber}</td></tr>
          <tr><td style="color:#6b7280;font-size:12px;padding:6px 0;">Amount</td><td style="color:#DC2626;font-size:13px;font-weight:700;text-align:right;">₹${order.amountDue.toFixed(2)}</td></tr>
          <tr><td style="color:#6b7280;font-size:12px;padding:6px 0;">UTR / Reference</td><td style="color:#fff;font-size:13px;font-weight:700;text-align:right;font-family:monospace;">${utrNumber.trim().toUpperCase()}</td></tr>
          <tr><td style="color:#6b7280;font-size:12px;padding:6px 0;">Method</td><td style="color:#fff;font-size:13px;font-weight:700;text-align:right;">${paymentMethod === "UPI" ? "Direct UPI" : "Bank Transfer"}</td></tr>
        </table>
      </div>
      <hr class="divider"/>
      <p class="small">Once verified, your order will move to production and you'll receive a tax invoice. If you have any questions, contact us at accounts@motoxplus.in</p>
    `),
  }).catch(() => {});

  // Notify admin team
  const adminEmail = process.env.ACCOUNTS_EMAIL || "accounts@motoxplus.in";
  sendEmail({
    to: adminEmail,
    subject: `[ACTION REQUIRED] Payment Submission — Order #${order.orderNumber}`,
    html: baseTemplate("New Payment Submission", `
      <div class="title">Payment Requires Verification</div>
      <p class="text">A dealer has submitted payment proof for order <strong style="color:#fff;">#${order.orderNumber}</strong>.</p>
      <div class="otp-box" style="text-align:left;">
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="color:#6b7280;font-size:12px;padding:6px 0;">Dealer</td><td style="color:#fff;font-size:13px;text-align:right;">${dealer.companyName}</td></tr>
          <tr><td style="color:#6b7280;font-size:12px;padding:6px 0;">Amount</td><td style="color:#DC2626;font-size:13px;font-weight:700;text-align:right;">₹${order.amountDue.toFixed(2)}</td></tr>
          <tr><td style="color:#6b7280;font-size:12px;padding:6px 0;">UTR</td><td style="color:#fff;font-size:13px;font-family:monospace;text-align:right;">${utrNumber.trim().toUpperCase()}</td></tr>
          <tr><td style="color:#6b7280;font-size:12px;padding:6px 0;">Method</td><td style="color:#fff;font-size:13px;text-align:right;">${paymentMethod === "UPI" ? "Direct UPI" : "Bank Transfer"}</td></tr>
        </table>
      </div>
      <a href="${process.env.NEXTAUTH_URL || "https://motoxplus.com"}/admin/payments" class="btn" style="text-decoration:none;display:inline-block;margin-top:16px;">Review in Dashboard</a>
    `),
  }).catch(() => {});

  return NextResponse.json({ submission, message: "Payment submitted for verification." });
}
