import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth/current-user";

// Accepts either the web NextAuth session or the mobile/plain-login JWT
// (cookie or Bearer) via getCurrentUserId — see lib/auth/current-user.ts.
export async function GET(req: NextRequest) {
  const userId = await getCurrentUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const authUser = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!authUser || authUser.role !== "DEALER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dealer = await prisma.dealer.findUnique({
    where: { userId },
    select: { ownerName: true, phone: true, address: true, city: true, state: true, pincode: true },
  });

  if (!dealer) {
    return NextResponse.json({ error: "Dealer not found" }, { status: 404 });
  }

  return NextResponse.json(dealer);
}

export async function DELETE(req: NextRequest) {
  const userId = await getCurrentUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const authUser = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!authUser || authUser.role !== "DEALER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dealer = await prisma.dealer.findUnique({
    where: { userId },
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
  await prisma.user.delete({ where: { id: userId } });

  return NextResponse.json({ success: true });
}
