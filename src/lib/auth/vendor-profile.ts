import { prisma } from "@/lib/prisma";

/**
 * True while a self-registered vendor (auto-approved at signup) hasn't finished the business profile yet. Mirrors
 * VendorSnapshot#profilePending in the Java API: Vendor APPROVED + automatic APPROVED decision + not submitted.
 *
 * Carried in the session so the middleware can send such a vendor to /vendor/onboarding (profile completion)
 * instead of the dashboard. Read-only; the marketplace schema belongs to the Java API (Flyway), so this is a raw
 * query. Any failure counts as "not pending": never lock a vendor out because this lookup broke.
 */
export async function isVendorProfilePending(vendorId: string | null | undefined): Promise<boolean> {
  if (!vendorId) return false;
  try {
    const rows = await prisma.$queryRaw<{ pending: boolean }[]>`
      SELECT (v.status = 'APPROVED' AND a.decision = 'APPROVED' AND a.submitted_at IS NULL) AS pending
      FROM public."Vendor" v
      JOIN marketplace.vendor_application a ON a.vendor_id = v.id
      WHERE v.id = ${vendorId}`;
    return rows[0]?.pending === true;
  } catch {
    return false;
  }
}
