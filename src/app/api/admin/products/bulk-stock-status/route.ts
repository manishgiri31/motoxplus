import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  ids: z.array(z.string()).min(1),
  stockStatus: z.enum(["IN_STOCK", "FEW_LEFT", "OUT_OF_STOCK"]),
});

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.issues }, { status: 400 });
  }

  const { ids, stockStatus } = parsed.data;
  const result = await prisma.product.updateMany({
    where: { id: { in: ids } },
    data: { stockStatus },
  });

  return NextResponse.json({ updated: result.count });
}
