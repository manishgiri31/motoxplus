import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateGRNNumber } from "@/lib/utils";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !ADMIN_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = 20;

  const [grns, total] = await Promise.all([
    prisma.goodsReceivedNote.findMany({
      include: {
        purchaseOrder: {
          select: { id: true, poNumber: true, vendor: { select: { companyName: true } } },
        },
        items: true,
      },
      orderBy: { receivedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.goodsReceivedNote.count(),
  ]);

  return NextResponse.json({ grns, total, page, pageSize });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !ADMIN_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { purchaseOrderId, receivedAt, qualityStatus, notes, items } = await req.json();

  if (!purchaseOrderId || !receivedAt || !items || items.length === 0) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const grn = await prisma.goodsReceivedNote.create({
    data: {
      grnNumber: generateGRNNumber(),
      purchaseOrderId,
      receivedById: session.user.id,
      receivedByName: session.user.name || session.user.email || "Unknown",
      receivedAt: new Date(receivedAt),
      qualityStatus: qualityStatus || "ACCEPTED",
      notes: notes || null,
      items: {
        create: items.map((item: any) => ({
          description: item.description,
          orderedQuantity: parseInt(item.orderedQuantity),
          receivedQuantity: parseInt(item.receivedQuantity),
          acceptedQuantity: parseInt(item.acceptedQuantity),
          rejectedQuantity: parseInt(item.rejectedQuantity || 0),
          rejectionReason: item.rejectionReason || null,
        })),
      },
    },
    include: { items: true, purchaseOrder: { include: { items: true } } },
  });

  // Determine if PO is fully or partially received
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: purchaseOrderId },
    include: { items: true, goodsReceivedNotes: { include: { items: true } } },
  });

  if (po) {
    const totalReceived = po.goodsReceivedNotes.reduce(
      (sum, g) => sum + g.items.reduce((s, i) => s + i.acceptedQuantity, 0),
      0
    );
    const totalOrdered = po.items.reduce((sum, i) => sum + i.quantity, 0);

    const newStatus = totalReceived >= totalOrdered ? "FULLY_RECEIVED" : "PARTIALLY_RECEIVED";

    await prisma.purchaseOrder.update({
      where: { id: purchaseOrderId },
      data: { status: newStatus },
    });
  }

  return NextResponse.json(grn, { status: 201 });
}
