import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/prisma";

/**
 * Read-only feed of AI/OCR/VIN detection attempts (feature: bike-ID inbox) —
 * lets admins review low-confidence auto-detections and manually correct the
 * matched vehicle via PATCH on the [id] route.
 */
export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = 25;

  const [logs, total] = await Promise.all([
    prisma.vehicleDetectionLog.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        detectedVehicle: { select: { id: true, name: true, slug: true } },
        detectedVariant: { select: { id: true, name: true } },
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.vehicleDetectionLog.count(),
  ]);

  return NextResponse.json({ logs, total, page, pageSize });
}
