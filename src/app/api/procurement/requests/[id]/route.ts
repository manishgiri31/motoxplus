import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !ADMIN_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const request = await prisma.purchaseRequest.findUnique({
    where: { id: params.id },
    include: {
      items: true,
      purchaseOrder: {
        include: { vendor: true, items: true },
      },
    },
  });

  if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(request);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !ADMIN_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { action, rejectionReason } = await req.json();

  if (action === "approve") {
    const request = await prisma.purchaseRequest.update({
      where: { id: params.id },
      data: {
        status: "APPROVED",
        approvedById: session.user.id,
        approvedAt: new Date(),
      },
    });
    return NextResponse.json(request);
  }

  if (action === "reject") {
    const request = await prisma.purchaseRequest.update({
      where: { id: params.id },
      data: {
        status: "REJECTED",
        approvedById: session.user.id,
        approvedAt: new Date(),
        rejectionReason: rejectionReason || "Rejected by admin",
      },
    });
    return NextResponse.json(request);
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
