import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/middleware";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * GET /api/auth/me - the current user, read fresh from the database.
 *
 * Identity comes from the NextAuth session first (every browser login has one), then from the
 * mx_access cookie / Bearer token that this route always accepted, so existing token callers are
 * unchanged. This is the single seam pages read "who am I" through (see lib/auth/me.ts), so the
 * session mechanism behind it can later change (e.g. to the Java API) without touching pages.
 *
 * Because it reads the DB, role/status changes and account disabling take effect immediately,
 * unlike the NextAuth JWT, which keeps its claims until it expires.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  let userId = session?.user?.id ?? null;
  if (!userId) userId = (await requireAuth(req))?.userId ?? null;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: true,
      image: true,
      emailVerified: true,
      mobileNumber: true,
      mobileVerified: true,
      twoFactorEnabled: true,
      lastLogin: true,
      createdAt: true,
      isActive: true,
      dealer: { select: { id: true, companyName: true, status: true, gstNumber: true } },
      admin: { select: { isSuperAdmin: true } },
      vendor: { select: { id: true, status: true } },
      customer: { select: { id: true, deliveryAddress: true, deliveryCity: true, deliveryState: true, deliveryPincode: true } },
    },
  });

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404, headers: NO_STORE });
  // A disabled account may still hold a valid NextAuth JWT until it expires; don't honour it.
  if (!user.isActive) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });

  const { isActive: _isActive, ...me } = user;
  return NextResponse.json({ user: me }, { headers: NO_STORE });
}
