import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "./current-user";

/**
 * Role of whoever is calling, resolved from either the web NextAuth session or
 * a mobile Bearer token (see getCurrentUserId). Null for anonymous callers,
 * unknown users and deactivated accounts.
 *
 * Catalog routes used to read the NextAuth session directly, which can never
 * see a Bearer token — the mobile app got a 401 for every product request.
 */
export async function getCallerRole(req: NextRequest): Promise<string | null> {
  const userId = await getCurrentUserId(req);
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, isActive: true } });
  if (!user || user.isActive === false) return null;
  return user.role;
}
