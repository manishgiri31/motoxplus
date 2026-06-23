import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { baseTemplate } from "@/lib/email/templates/base";
import { generateInvoiceNumber } from "@/lib/utils";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN", "STAFF"];

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !ADMIN_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { notes } = await req.json().catch(() => ({}));

  const submission = await prisma.paymentSubmission.findUnique({
    where: { id: params.id },
    include: {
      order: {
        include: {
          dealer: { include: { user: { select: { email: true } } } },
          invoice: true,
        },
      },
    },
  });

  if (!submission) return NextResponse.json({ error: "Submission not found." }, { status: 404 });
  if (submission.status === "VERIFIED") {
    return NextResponse.json({ error: "Already verified." }, { status: 409 });
  }

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    // Mark submission verified
    await tx.paymentSubmission.update({
      where: { id: params.id },
      data: {
        status: "VERIFIED",
        verifiedAt: now,
        verifiedBy: session.user.id,
        notes: notes || null,
      },
    });

    // Update order: paid + confirmed
    await tx.order.update({
      where: { id: submission.orderId },
      data: {
        paymentStatus: "PAID",
        amountPaid: submission.order.amountDue,
        amountDue: 0,
        status: submission.order.status === "PENDING" ? "CONFIRMED" : submission.order.status,
      },
    });

    // Generate invoice if not already created
    if (!submission.order.invoice) {
      await tx.invoice.create({
        data: {
          invoiceNumber: generateInvoiceNumber(),
          orderId: submission.orderId,
          dealerId: submission.dealerId,
          subtotal: submission.order.subtotal ?? 0,
          gstAmount: submission.order.gstAmount ?? 0,
          grandTotal: submission.order.grandTotal,
        },
      });
    }
  });

  // Reload the order with invoice for email
  const updatedOrder = await prisma.order.findUnique({
    where: { id: submission.orderId },
    include: { invoice: true, dealer: { include: { user: { select: { email: true } } } } },
  });

  // Notify dealer
  sendEmail({
    to: submission.payerEmail,
    subject: `Payment Verified — Order #${submission.order.orderNumber} | MOTOXPLUS`,
    html: baseTemplate("Payment Verified", `
      <div class="title">✓ Payment Verified</div>
      <p class="text">Hi ${submission.payerName},</p>
      <p class="text">Great news! Your payment for order <strong style="color:#fff;">#${submission.order.orderNumber}</strong> has been verified by our accounts team. Your order is now confirmed and will move to production.</p>
      <div class="otp-box" style="text-align:left;">
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="color:#6b7280;font-size:12px;padding:6px 0;">Order Number</td><td style="color:#fff;font-size:13px;font-weight:700;text-align:right;">#${submission.order.orderNumber}</td></tr>
          <tr><td style="color:#6b7280;font-size:12px;padding:6px 0;">Amount Verified</td><td style="color:#22c55e;font-size:13px;font-weight:700;text-align:right;">₹${submission.amount.toFixed(2)}</td></tr>
          <tr><td style="color:#6b7280;font-size:12px;padding:6px 0;">UTR</td><td style="color:#fff;font-size:13px;font-family:monospace;text-align:right;">${submission.utrNumber}</td></tr>
          <tr><td style="color:#6b7280;font-size:12px;padding:6px 0;">Invoice</td><td style="color:#fff;font-size:13px;text-align:right;">${updatedOrder?.invoice?.invoiceNumber || "—"}</td></tr>
        </table>
      </div>
      ${notes ? `<p class="small">Note from accounts: ${notes}</p>` : ""}
      <hr class="divider"/>
      <p class="small">A tax invoice has been generated. You can view and download it from your dealer portal. Your order will be dispatched as per the production schedule.</p>
    `),
  }).catch(() => {});

  return NextResponse.json({ message: "Payment verified. Order confirmed and invoice generated." });
}
