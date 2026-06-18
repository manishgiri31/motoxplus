import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !ADMIN_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const staff = await prisma.user.findMany({
    where: { role: "STAFF" },
    select: {
      id: true,
      name: true,
      email: true,
      department: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(staff);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !ADMIN_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name, email, password, department } = await req.json();

  if (!name || !email || !password || !department) {
    return NextResponse.json({ error: "All fields are required" }, { status: 400 });
  }

  const VALID_DEPARTMENTS = ["SALES", "MARKETING", "PRODUCTION", "ACCOUNTS"];
  if (!VALID_DEPARTMENTS.includes(department)) {
    return NextResponse.json({ error: "Invalid department" }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Email already in use" }, { status: 400 });
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
      role: "STAFF",
      department,
    },
    select: { id: true, name: true, email: true, department: true, createdAt: true },
  });

  return NextResponse.json(user, { status: 201 });
}
