import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !ADMIN_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const lead = await prisma.lead.findUnique({ where: { id: params.id } });
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  if (lead.status === "CONVERTED") {
    return NextResponse.json({ error: "Lead already converted" }, { status: 400 });
  }

  const { gstNumber, address, pincode, creditLimit, password } = await req.json();

  if (!gstNumber || !address || !pincode || !password) {
    return NextResponse.json({ error: "GST number, address, pincode and password are required" }, { status: 400 });
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const existingUser = await prisma.user.findUnique({ where: { email: lead.email } });
  if (existingUser) {
    return NextResponse.json({ error: "A user with this email already exists" }, { status: 409 });
  }

  const user = await prisma.user.create({
    data: {
      name: lead.ownerName,
      email: lead.email,
      password: hashedPassword,
      role: "DEALER",
      dealer: {
        create: {
          companyName: lead.companyName,
          ownerName: lead.ownerName,
          gstNumber,
          phone: lead.phone,
          state: lead.state,
          city: lead.city,
          address,
          pincode,
          status: "ACTIVE",
          creditLimit: creditLimit ? parseFloat(creditLimit) : 0,
        },
      },
    },
    include: { dealer: true },
  });

  // Mark lead as converted
  await prisma.lead.update({
    where: { id: params.id },
    data: {
      status: "CONVERTED",
      convertedAt: new Date(),
      dealerId: user.dealer!.id,
    },
  });

  // Log the conversion
  await prisma.leadActivity.create({
    data: {
      leadId: params.id,
      performedBy: session.user.id,
      performedByName: session.user.name || "Admin",
      type: "OTHER",
      description: `Lead converted to dealer account. Dealer ID: ${user.dealer!.id}`,
      outcome: "POSITIVE",
    },
  });

  return NextResponse.json({ dealer: user.dealer, userId: user.id });
}
