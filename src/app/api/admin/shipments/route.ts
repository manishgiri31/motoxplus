import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createDelhiveryShipment } from "@/lib/delhivery";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const status = searchParams.get("status");
  const pageSize = 20;

  const where = status ? { status: status as any } : {};

  const [shipments, total] = await Promise.all([
    prisma.shipment.findMany({
      where,
      include: {
        order: {
          include: { dealer: { include: { user: true } } },
        },
        events: { orderBy: { timestamp: "desc" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.shipment.count({ where }),
  ]);

  return NextResponse.json({ shipments, total, page, pageSize });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orderId } = await req.json();
  if (!orderId) return NextResponse.json({ error: "orderId required" }, { status: 400 });

  try {
    const result = await createDelhiveryShipment(orderId);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[Admin] shipment creation error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Shipment creation failed" },
      { status: 500 }
    );
  }
}
