import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/prisma";

function toFrameUrls(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String).map((s) => s.trim()).filter(Boolean);
  if (typeof v === "string") return v.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  return [];
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string; spinId: string } }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (body.variantId !== undefined) data.variantId = body.variantId || null;
  if (body.colorId !== undefined) data.colorId = body.colorId || null;
  if (body.sortOrder !== undefined) data.sortOrder = parseInt(body.sortOrder) || 0;
  if (body.frameUrls !== undefined) {
    const frameUrls = toFrameUrls(body.frameUrls);
    data.frameUrls = frameUrls;
    data.frameCount = frameUrls.length;
  }

  const spin = await prisma.vehicleSpin.update({ where: { id: params.spinId }, data });
  return NextResponse.json(spin);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; spinId: string } }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.vehicleSpin.delete({ where: { id: params.spinId } });
  return NextResponse.json({ success: true });
}
