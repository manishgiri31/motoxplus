import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { baseTemplate } from "@/lib/email/templates/base";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || !ADMIN_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { documents, note } = await req.json();

  if (!Array.isArray(documents) || documents.length === 0) {
    return NextResponse.json({ error: "Specify at least one document to request" }, { status: 400 });
  }

  const dealer = await prisma.dealer.findUnique({ where: { id }, include: { user: true } });
  if (!dealer) return NextResponse.json({ error: "Dealer not found" }, { status: 404 });

  const content = `
    <div class="title">Additional Documents Required</div>
    <p class="text">Hi ${dealer.ownerName},</p>
    <p class="text">To continue reviewing your application for <strong style="color:#fff;">${dealer.companyName}</strong>, our team needs the following:</p>
    <ul style="color:#9ca3af;font-size:14px;line-height:2;padding-left:20px;margin-bottom:16px;">
      ${documents.map((d: string) => `<li>${d}</li>`).join("")}
    </ul>
    ${note ? `<p class="text">${note}</p>` : ""}
    <p class="small">Reply to this email or contact us at support@motoxplus.in to submit these documents.</p>
  `;

  await sendEmail({
    to: dealer.user.email,
    subject: "Additional Documents Required — MOTOXPLUS",
    html: baseTemplate("Documents Required — MOTOXPLUS", content),
  });

  return NextResponse.json({ message: "Document request sent to dealer." });
}
