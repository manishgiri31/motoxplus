import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendEmail, dealerApprovedTemplate } from "@/lib/email";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { status, creditLimit } = await req.json();

  const before = status ? await prisma.dealer.findUnique({ where: { id: params.id }, select: { status: true } }) : null;

  const dealer = await prisma.dealer.update({
    where: { id: params.id },
    data: {
      ...(status && { status }),
      ...(creditLimit !== undefined && { creditLimit }),
    },
    include: { user: true },
  });

  if (status === "ACTIVE" && before?.status !== "ACTIVE") {
    const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL}/login`;
    await sendEmail({
      to: dealer.user.email,
      subject: "Your Dealer Account is Approved — MOTOXPLUS",
      html: dealerApprovedTemplate(dealer.user.name || dealer.ownerName, dealer.companyName, loginUrl),
    }).catch((err) => console.error("[AdminDealerUpdate] Failed to send approval email:", err));
  }

  return NextResponse.json(dealer);
}
