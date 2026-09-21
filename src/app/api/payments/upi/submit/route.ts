import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { baseTemplate } from "@/lib/email/templates/base";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { resolveOrderActor, ACCOUNT_NOT_VERIFIED_MESSAGE } from "@/lib/auth/verified-account";
import { checkIPRateLimit } from "@/lib/auth/rate-limit";
import { getClientIP } from "@/lib/auth/middleware";
import { escapeHtml } from "@/lib/utils";
import { isPlaceholderEmail } from "@/lib/phone";

// Accepts the web NextAuth session or the mobile/plain-login JWT (cookie or
// Bearer) via getCurrentUserId — see lib/auth/current-user.ts. Same pattern
// already used by payments/create-order and payments/verify.
export async function POST(req: NextRequest) {
  const ip = getClientIP(req);
  if (!(await checkIPRateLimit(ip, 5, 60))) {
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }

  const userId = await getCurrentUserId(req);
  if (!userId) {
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

  const actor = await resolveOrderActor(userId);
  if (!actor) return NextResponse.json({ error: ACCOUNT_NOT_VERIFIED_MESSAGE }, { status: 403 });

  // actor.dealer/.customer already include their `user` relation (see
  // getVerifiedDealer/getVerifiedCustomer) — no need to re-fetch the order
  // with a dealer/customer include just to reach an email address below.
  const order = await prisma.order.findFirst({
    where: actor.channel === "B2C" ? { id: orderId, customerId: actor.customer.id } : { id: orderId, dealerId: actor.dealer.id },
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

  const submission = await prisma.paymentSubmission.create({
    data: {
      orderId: order.id,
      ...(actor.channel === "B2C" ? { customerId: actor.customer.id } : { dealerId: actor.dealer.id }),
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

  // HTML email templates interpolate these directly with no JSX escaping —
  // payerName and the UTR (charset-unrestricted, only length-checked above)
  // must be escaped before they reach either template.
  const safePayerName = escapeHtml(payerName.trim());
  const safeUtr = escapeHtml(utrNumber.trim().toUpperCase());
  const methodLabel = paymentMethod === "UPI" ? "Direct UPI" : "Bank Transfer";

  // Sent to the account's own verified email — never the client-supplied
  // payerEmail — so this can't be used to relay attacker-controlled HTML to an
  // arbitrary third-party address from our verified sending domain. A B2C
  // customer who skipped the optional email field has a placeholder
  // (`@phone.motoxplus.invalid`, see lib/phone.ts) — skip sending to that,
  // there's no real inbox behind it.
  const ownerEmail = actor.channel === "B2C" ? actor.customer.user.email : actor.dealer.user.email;
  if (!isPlaceholderEmail(ownerEmail)) sendEmail({
    to: ownerEmail,
    subject: `Payment Submitted — Order #${order.orderNumber} | MOTOXPLUS`,
    html: baseTemplate("Payment Submitted", `
      <div class="title">Payment Submitted for Verification</div>
      <p class="text">Hi ${safePayerName},</p>
      <p class="text">We have received your payment details for order <strong style="color:#fff;">#${order.orderNumber}</strong>. Our accounts team will verify the payment within 1-2 business hours.</p>
      <div class="otp-box" style="text-align:left;">
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="color:#6b7280;font-size:12px;padding:6px 0;">Order Number</td><td style="color:#fff;font-size:13px;font-weight:700;text-align:right;">#${order.orderNumber}</td></tr>
          <tr><td style="color:#6b7280;font-size:12px;padding:6px 0;">Amount</td><td style="color:#DC2626;font-size:13px;font-weight:700;text-align:right;">₹${order.amountDue.toFixed(2)}</td></tr>
          <tr><td style="color:#6b7280;font-size:12px;padding:6px 0;">UTR / Reference</td><td style="color:#fff;font-size:13px;font-weight:700;text-align:right;font-family:monospace;">${safeUtr}</td></tr>
          <tr><td style="color:#6b7280;font-size:12px;padding:6px 0;">Method</td><td style="color:#fff;font-size:13px;font-weight:700;text-align:right;">${methodLabel}</td></tr>
        </table>
      </div>
      <hr class="divider"/>
      <p class="small">Once verified, your order will move to production and you'll receive a tax invoice. If you have any questions, contact us at accounts@motoxplus.in</p>
    `),
  }).catch(() => {});

  // Notify admin team
  const adminEmail = process.env.ACCOUNTS_EMAIL || "accounts@motoxplus.in";
  const ownerLabel = actor.channel === "B2C" ? "Retail customer" : "Dealer";
  const ownerName = actor.channel === "B2C" ? (actor.customer.user.name || "Customer") : actor.dealer.companyName;
  sendEmail({
    to: adminEmail,
    subject: `[ACTION REQUIRED] Payment Submission — Order #${order.orderNumber}`,
    html: baseTemplate("New Payment Submission", `
      <div class="title">Payment Requires Verification</div>
      <p class="text">A ${actor.channel === "B2C" ? "retail customer" : "dealer"} has submitted payment proof for order <strong style="color:#fff;">#${order.orderNumber}</strong>.</p>
      <div class="otp-box" style="text-align:left;">
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="color:#6b7280;font-size:12px;padding:6px 0;">${ownerLabel}</td><td style="color:#fff;font-size:13px;text-align:right;">${escapeHtml(ownerName)}</td></tr>
          <tr><td style="color:#6b7280;font-size:12px;padding:6px 0;">Amount</td><td style="color:#DC2626;font-size:13px;font-weight:700;text-align:right;">₹${order.amountDue.toFixed(2)}</td></tr>
          <tr><td style="color:#6b7280;font-size:12px;padding:6px 0;">UTR</td><td style="color:#fff;font-size:13px;font-family:monospace;text-align:right;">${safeUtr}</td></tr>
          <tr><td style="color:#6b7280;font-size:12px;padding:6px 0;">Method</td><td style="color:#fff;font-size:13px;text-align:right;">${methodLabel}</td></tr>
        </table>
      </div>
      <a href="${process.env.NEXTAUTH_URL || "https://motoxplus.com"}/admin/payments" class="btn" style="text-decoration:none;display:inline-block;margin-top:16px;">Review in Dashboard</a>
    `),
  }).catch(() => {});

  return NextResponse.json({ submission, message: "Payment submitted for verification." });
}
