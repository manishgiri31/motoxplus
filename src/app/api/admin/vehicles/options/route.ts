import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/prisma";

/**
 * Lookup payload for admin pickers that need to resolve vehicle →
 * generation → variant → section (fitment editor, VIN pattern forms,
 * diagram/hotspot forms) without each screen re-querying the full catalog.
 */
export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [vehicles, sections, manufacturers] = await Promise.all([
    prisma.vehicle.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        category: true,
        manufacturer: { select: { name: true } },
        generations: { orderBy: { sortOrder: "asc" }, select: { id: true, name: true } },
        variants: { orderBy: { sortOrder: "asc" }, select: { id: true, name: true, generationId: true } },
      },
    }),
    prisma.vehiclePartSection.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    prisma.vehicleManufacturer.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);

  return NextResponse.json({ vehicles, sections, manufacturers });
}
