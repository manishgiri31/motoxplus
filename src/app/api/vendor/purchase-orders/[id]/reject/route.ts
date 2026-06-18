import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "VENDOR") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const vendor = await prisma.vendor.findUnique({ where: { userId: session.user.id } });
  if (!vendor) return NextResponse.json({ error: "Vendor not found" }, { status: 404 });

  const po = await prisma.purchaseOrder.findFirst({
    where: { id: params.id, vendorId: vendor.id },
  });

  if (!po) return NextResponse.json({ error: "Purchase order not found" }, { status: 404 });
  if (po.status !== "SENT") {
    return NextResponse.json({ error: "Only SENT orders can be rejected" }, { status: 400 });
  }

  const { reason } = await req.json();

  const updated = await prisma.purchaseOrder.update({
    where: { id: params.id },
    data: {
      status: "REJECTED",
      rejectedAt: new Date(),
      vendorNotes: reason || null,
    },
  });

  return NextResponse.json(updated);
}
