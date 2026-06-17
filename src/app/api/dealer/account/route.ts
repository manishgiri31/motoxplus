import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE() {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "DEALER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dealer = await prisma.dealer.findUnique({
    where: { userId: session.user.id },
  });

  if (!dealer) {
    return NextResponse.json({ error: "Dealer not found" }, { status: 404 });
  }

  // Delete in FK-safe order:
  // 1. Invoices (references both dealer and order — no cascade)
  await prisma.invoice.deleteMany({ where: { dealerId: dealer.id } });

  // 2. Orders (cascades → OrderItems, Payments)
  await prisma.order.deleteMany({ where: { dealerId: dealer.id } });

  // 3. User (cascades → Dealer → Cart → CartItems, Account, Session)
  await prisma.user.delete({ where: { id: session.user.id } });

  return NextResponse.json({ success: true });
}
