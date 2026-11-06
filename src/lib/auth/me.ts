import { headers } from "next/headers";
import type { DealerStatus, StaffDepartment, UserRole, VendorStatus } from "@prisma/client";

/** The JSON shape GET /api/auth/me returns under `user`. */
export interface Me {
  id: string;
  name: string | null;
  email: string;
  role: UserRole;
  department: StaffDepartment | null;
  image: string | null;
  emailVerified: string | null;
  mobileNumber: string | null;
  mobileVerified: boolean;
  twoFactorEnabled: boolean;
  lastLogin: string | null;
  createdAt: string;
  dealer: { id: string; companyName: string; status: DealerStatus; gstNumber: string | null } | null;
  admin: { isSuperAdmin: boolean } | null;
  vendor: { id: string; status: VendorStatus } | null;
  customer: { id: string } | null;
}

/**
 * Where server components reach /api/auth/me. Defaults to this same Next.js process; set
 * INTERNAL_API_URL to move "who am I" to another backend (e.g. the Java API) with no page changes.
 */
export function internalApiBaseUrl(env: Record<string, string | undefined> = process.env): string {
  return env.INTERNAL_API_URL?.replace(/\/+$/, "") || `http://127.0.0.1:${env.PORT || 3000}`;
}

/**
 * The signed-in user for a Server Component, via GET /api/auth/me (forwarding the visitor's cookies).
 * Returns null when nobody is signed in (401/404). Throws on any other failure rather than returning
 * null, so an API outage shows an error page instead of silently logging the user out.
 */
export async function getMe(): Promise<Me | null> {
  const cookie = (await headers()).get("cookie") ?? "";
  const res = await fetch(`${internalApiBaseUrl()}/api/auth/me`, {
    headers: { cookie },
    cache: "no-store",
  });
  if (res.status === 401 || res.status === 404) return null;
  if (!res.ok) throw new Error(`GET /api/auth/me failed with HTTP ${res.status}`);
  const body = (await res.json()) as { user: Me };
  return body.user;
}
