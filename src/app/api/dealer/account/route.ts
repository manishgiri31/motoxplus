import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { checkIPRateLimit } from "@/lib/auth/rate-limit";
import { getClientIP } from "@/lib/auth/middleware";

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
  // A long-lived (or stolen) session cookie alone shouldn't be enough to
  // permanently destroy an account — require the current password again,
  // right now, as proof of fresh re-authentication. Rate-limited since this
  // is effectively a password-check endpoint.
  const ip = getClientIP(req);
  if (!(await checkIPRateLimit(ip, 5, 60))) {
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }

  const userId = await getCurrentUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const authUser = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, password: true } });
  if (!authUser || authUser.role !== "DEALER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { password } = await req.json().catch(() => ({ password: undefined }));
  if (!password || typeof password !== "string") {
    return NextResponse.json({ error: "Enter your password to confirm account deletion." }, { status: 400 });
  }
  if (!authUser.password || !(await bcrypt.compare(password, authUser.password))) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
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
