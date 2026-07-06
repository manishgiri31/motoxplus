import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/**
 * Shared guard for the vehicle-catalog admin API surface (manufacturers,
 * vehicles, generations, variants, sections, diagrams, 3D/360 assets, VIN
 * patterns, product fitment, detection log). Mirrors the inline
 * `requireAdmin()` pattern already duplicated per-route under
 * api/admin/products — centralized here since this pass adds ~25 new routes.
 */
export async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) return null;
  return session;
}
