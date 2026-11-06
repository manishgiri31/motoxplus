import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateVendorSupply, type VendorSupplyValidation } from "@/lib/catalog/part-categories";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
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

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
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

  // What the vendor supplies (approved part categories + vehicle segments) is edited as one unit.
  let supply: Extract<VendorSupplyValidation, { ok: true }> | null = null;
  if (body.categoryIds !== undefined || body.vehicleSegments !== undefined) {
    const v = await validateVendorSupply(body);
    if (!v.ok) return NextResponse.json({ error: v.error, field: v.field }, { status: 400 });
    supply = v;
  }

  const exists = await prisma.vendor.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!exists) return NextResponse.json({ error: "Vendor not found" }, { status: 404 });

  const vendor = await prisma.vendor.update({
    where: { id: params.id },
    data: {
      ...(supply && {
        vehicleSegments: supply.vehicleSegments,
        partCategories: { deleteMany: {}, create: supply.categoryIds.map((categoryId) => ({ categoryId })) },
      }),
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
