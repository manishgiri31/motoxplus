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

  const po = await prisma.purchaseOrder.findUnique({
    where: { id: params.id },
    include: {
      vendor: { include: { contacts: { where: { isPrimary: true }, take: 1 } } },
      items: true,
      purchaseRequest: true,
      goodsReceivedNotes: { include: { items: true }, orderBy: { createdAt: "desc" } },
      vendorPayments: { orderBy: { paymentDate: "desc" } },
    },
  });

  if (!po) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(po);
}

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session || !ADMIN_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { status, vendorNotes } = await req.json();

  const validStatuses = ["DRAFT", "SENT", "CANCELLED", "CLOSED", "FULLY_RECEIVED"];
  if (status && !validStatuses.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const data: any = {};
  if (status) {
    data.status = status;
    if (status === "CLOSED") data.closedAt = new Date();
    if (status === "CANCELLED") data.closedAt = new Date();
  }
  if (vendorNotes !== undefined) data.vendorNotes = vendorNotes;

  const po = await prisma.purchaseOrder.update({
    where: { id: params.id },
    data,
    include: { vendor: true, items: true },
  });

  return NextResponse.json(po);
}
