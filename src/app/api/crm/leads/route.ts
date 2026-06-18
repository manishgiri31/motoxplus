import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateLeadNumber } from "@/lib/utils";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !ADMIN_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const assignedToId = searchParams.get("assignedToId");
  const search = searchParams.get("search");
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = parseInt(searchParams.get("pageSize") || "20");

  const where: any = {};
  if (status) where.status = status;
  if (assignedToId) where.assignedToId = assignedToId;
  if (search) {
    where.OR = [
      { companyName: { contains: search, mode: "insensitive" } },
      { ownerName: { contains: search, mode: "insensitive" } },
      { phone: { contains: search } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }

  const [leads, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      include: {
        _count: { select: { activities: true, notes: true } },
      },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.lead.count({ where }),
  ]);

  return NextResponse.json({ leads, total, page, pageSize });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !ADMIN_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const {
    companyName, ownerName, email, phone, city, state,
    source, priority, estimatedValue, nextFollowUp, notes: initialNote,
  } = await req.json();

  if (!companyName || !ownerName || !phone || !city || !state) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const lead = await prisma.lead.create({
    data: {
      leadNumber: generateLeadNumber(),
      companyName,
      ownerName,
      email: email || "",
      phone,
      city,
      state,
      source: source || "WEBSITE",
      priority: priority || "MEDIUM",
      estimatedValue: estimatedValue ? parseFloat(estimatedValue) : null,
      nextFollowUp: nextFollowUp ? new Date(nextFollowUp) : null,
    },
  });

  // Auto-create first activity
  if (initialNote) {
    await prisma.leadNote.create({
      data: {
        leadId: lead.id,
        authorId: session.user.id,
        authorName: session.user.name || session.user.email || "Admin",
        content: initialNote,
      },
    });
  }

  return NextResponse.json(lead, { status: 201 });
}
