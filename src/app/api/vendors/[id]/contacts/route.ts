import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session || !ADMIN_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contacts = await prisma.vendorContact.findMany({
    where: { vendorId: params.id },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
  });

  return NextResponse.json(contacts);
}

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session || !ADMIN_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name, designation, email, phone, isPrimary } = await req.json();

  if (!name || !phone) {
    return NextResponse.json({ error: "Name and phone are required" }, { status: 400 });
  }

  // Only one primary contact allowed
  if (isPrimary) {
    await prisma.vendorContact.updateMany({
      where: { vendorId: params.id, isPrimary: true },
      data: { isPrimary: false },
    });
  }

  const contact = await prisma.vendorContact.create({
    data: {
      vendorId: params.id,
      name,
      designation: designation || null,
      email: email || null,
      phone,
      isPrimary: isPrimary ?? false,
    },
  });

  return NextResponse.json(contact, { status: 201 });
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session || !ADMIN_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { contactId } = await req.json();

  await prisma.vendorContact.delete({ where: { id: contactId, vendorId: params.id } });

  return NextResponse.json({ success: true });
}
