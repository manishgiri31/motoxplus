import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateVendorCode } from "@/lib/utils";
import bcrypt from "bcryptjs";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !ADMIN_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const category = searchParams.get("category");
  const search = searchParams.get("search");
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = 20;

  const where: any = {};
  if (status) where.status = status;
  if (category) where.category = category;
  if (search) {
    where.OR = [
      { companyName: { contains: search, mode: "insensitive" } },
      { ownerName: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { vendorCode: { contains: search, mode: "insensitive" } },
    ];
  }

  const [vendors, total] = await Promise.all([
    prisma.vendor.findMany({
      where,
      include: {
        contacts: { where: { isPrimary: true }, take: 1 },
        _count: { select: { payments: true, ratings: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.vendor.count({ where }),
  ]);

  return NextResponse.json({ vendors, total, page, pageSize });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !ADMIN_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const {
    companyName, ownerName, email, phone, category,
    gstNumber, panNumber, address, city, state, pincode,
    website, creditDays, bankName, accountNumber, ifscCode, notes,
    createPortalAccess, password,
  } = body;

  if (!companyName || !ownerName || !email || !phone || !category || !address || !city || !state || !pincode) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const existing = await prisma.vendor.findUnique({ where: { email } });
  if (existing) return NextResponse.json({ error: "Vendor with this email already exists" }, { status: 409 });

  const vendorCode = generateVendorCode();

  let userId: string | undefined;

  if (createPortalAccess && password) {
    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        name: ownerName,
        email,
        password: hashedPassword,
        role: "VENDOR",
      },
    });
    userId = user.id;
  }

  const vendor = await prisma.vendor.create({
    data: {
      vendorCode,
      companyName,
      ownerName,
      email,
      phone,
      category,
      gstNumber: gstNumber || null,
      panNumber: panNumber || null,
      address,
      city,
      state,
      pincode,
      website: website || null,
      creditDays: creditDays ? parseInt(creditDays) : 30,
      bankName: bankName || null,
      accountNumber: accountNumber || null,
      ifscCode: ifscCode || null,
      notes: notes || null,
      ...(userId && { userId }),
    },
    include: { contacts: true, documents: true },
  });

  return NextResponse.json(vendor, { status: 201 });
}
