import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { status, creditLimit } = await req.json();

  const dealer = await prisma.dealer.update({
    where: { id: params.id },
    data: {
      ...(status && { status }),
      ...(creditLimit !== undefined && { creditLimit }),
    },
    include: { user: true },
  });

  return NextResponse.json(dealer);
}
