import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
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
    return NextResponse.json({ error: "Only SENT orders can be accepted" }, { status: 400 });
  }

  const updated = await prisma.purchaseOrder.update({
    where: { id: params.id },
    data: { status: "ACCEPTED", acceptedAt: new Date() },
  });

  return NextResponse.json(updated);
}
