import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !ADMIN_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const vendor = await prisma.vendor.findUnique({
    where: { id: params.id },
    include: {
      contacts: true,
      documents: true,
      ratings: { orderBy: { createdAt: "desc" } },
      payments: { orderBy: { createdAt: "desc" }, take: 10 },
      user: { select: { id: true, email: true, name: true, createdAt: true } },
    },
  });

  if (!vendor) return NextResponse.json({ error: "Vendor not found" }, { status: 404 });

  return NextResponse.json(vendor);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !ADMIN_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const {
    companyName, ownerName, phone, category,
    gstNumber, panNumber, address, city, state, pincode,
    website, creditDays, bankName, accountNumber, ifscCode, notes,
  } = body;

  const vendor = await prisma.vendor.update({
    where: { id: params.id },
    data: {
      ...(companyName && { companyName }),
      ...(ownerName && { ownerName }),
      ...(phone && { phone }),
      ...(category && { category }),
      ...(gstNumber !== undefined && { gstNumber: gstNumber || null }),
      ...(panNumber !== undefined && { panNumber: panNumber || null }),
      ...(address && { address }),
      ...(city && { city }),
      ...(state && { state }),
      ...(pincode && { pincode }),
      ...(website !== undefined && { website: website || null }),
      ...(creditDays !== undefined && { creditDays: parseInt(creditDays) }),
      ...(bankName !== undefined && { bankName: bankName || null }),
      ...(accountNumber !== undefined && { accountNumber: accountNumber || null }),
      ...(ifscCode !== undefined && { ifscCode: ifscCode || null }),
      ...(notes !== undefined && { notes: notes || null }),
    },
    include: { contacts: true, documents: true },
  });

  return NextResponse.json(vendor);
}
