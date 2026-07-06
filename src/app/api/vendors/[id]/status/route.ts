import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendEmail, vendorApprovedTemplate } from "@/lib/email";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];
const VALID_STATUSES = ["PENDING", "APPROVED", "REJECTED", "SUSPENDED", "BLACKLISTED"];

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !ADMIN_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { status } = await req.json();

  if (!status || !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const before = await prisma.vendor.findUnique({ where: { id: params.id }, select: { status: true } });

  const vendor = await prisma.vendor.update({
    where: { id: params.id },
    data: { status },
  });

  if (status === "APPROVED" && before?.status !== "APPROVED") {
    const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL}/login`;
    await sendEmail({
      to: vendor.email,
      subject: "Your Vendor Account is Approved — MOTOXPLUS",
      html: vendorApprovedTemplate(vendor.ownerName, vendor.companyName, loginUrl),
    }).catch((err) => console.error("[VendorStatusUpdate] Failed to send approval email:", err));
  }

  return NextResponse.json(vendor);
}
