import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { baseTemplate } from "@/lib/email/templates/base";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN", "STAFF"];

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !ADMIN_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { reason } = await req.json().catch(() => ({}));
  if (!reason?.trim()) {
    return NextResponse.json({ error: "Rejection reason is required." }, { status: 400 });
  }

  const submission = await prisma.paymentSubmission.findUnique({
    where: { id: params.id },
    include: { order: true },
  });

  if (!submission) return NextResponse.json({ error: "Submission not found." }, { status: 404 });
  if (submission.status === "VERIFIED") {
    return NextResponse.json({ error: "Cannot reject a verified payment." }, { status: 409 });
  }

  await prisma.$transaction([
    prisma.paymentSubmission.update({
      where: { id: params.id },
      data: {
        status: "REJECTED",
        rejectionReason: reason.trim(),
        rejectedAt: new Date(),
        rejectedBy: session.user.id,
      },
    }),
    // Revert order payment status so dealer can resubmit
    prisma.order.update({
      where: { id: submission.orderId },
      data: { paymentStatus: "PENDING" },
    }),
  ]);

  // Notify dealer
  sendEmail({
    to: submission.payerEmail,
    subject: `Payment Rejected — Order #${submission.order.orderNumber} | MOTOXPLUS`,
    html: baseTemplate("Payment Rejected", `
      <div class="title">Payment Could Not Be Verified</div>
      <p class="text">Hi ${submission.payerName},</p>
      <p class="text">Unfortunately, we were unable to verify your payment for order <strong style="color:#fff;">#${submission.order.orderNumber}</strong>.</p>
      <div class="warning">
        <div class="warning-text"><strong>Reason:</strong> ${reason.trim()}</div>
      </div>
      <div class="otp-box" style="text-align:left;">
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="color:#6b7280;font-size:12px;padding:6px 0;">Order Number</td><td style="color:#fff;font-size:13px;font-weight:700;text-align:right;">#${submission.order.orderNumber}</td></tr>
          <tr><td style="color:#6b7280;font-size:12px;padding:6px 0;">Submitted UTR</td><td style="color:#fff;font-size:13px;font-family:monospace;text-align:right;">${submission.utrNumber}</td></tr>
        </table>
      </div>
      <p class="text">Please resubmit your payment details from your dealer portal. If you believe this is an error, contact us at accounts@motoxplus.in</p>
      <a href="${process.env.NEXTAUTH_URL || "https://motoxplus.com"}/dealer/orders/${submission.orderId}" class="btn" style="text-decoration:none;display:inline-block;margin-top:16px;">Go to Order</a>
    `),
  }).catch(() => {});

  return NextResponse.json({ message: "Payment rejected. Dealer has been notified." });
}
