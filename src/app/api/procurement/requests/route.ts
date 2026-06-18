import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generatePurchaseRequestNumber } from "@/lib/utils";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !ADMIN_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const urgency = searchParams.get("urgency");
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = 20;

  const where: any = {};
  if (status) where.status = status;
  if (urgency) where.urgency = urgency;

  const [requests, total] = await Promise.all([
    prisma.purchaseRequest.findMany({
      where,
      include: {
        items: true,
        purchaseOrder: { select: { id: true, poNumber: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.purchaseRequest.count({ where }),
  ]);

  return NextResponse.json({ requests, total, page, pageSize });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !ADMIN_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { title, urgency, departmentCode, notes, items } = await req.json();

  if (!title || !items || items.length === 0) {
    return NextResponse.json({ error: "Title and at least one item are required" }, { status: 400 });
  }

  const request = await prisma.purchaseRequest.create({
    data: {
      requestNumber: generatePurchaseRequestNumber(),
      requestedById: session.user.id,
      requestedByName: session.user.name || session.user.email || "Unknown",
      title,
      urgency: urgency || "NORMAL",
      departmentCode: departmentCode || "GENERAL",
      notes: notes || null,
      status: "SUBMITTED",
      items: {
        create: items.map((item: any) => ({
          description: item.description,
          quantity: parseInt(item.quantity),
          unit: item.unit || "PCS",
          estimatedUnitPrice: item.estimatedUnitPrice ? parseFloat(item.estimatedUnitPrice) : null,
          notes: item.notes || null,
        })),
      },
    },
    include: { items: true },
  });

  return NextResponse.json(request, { status: 201 });
}
