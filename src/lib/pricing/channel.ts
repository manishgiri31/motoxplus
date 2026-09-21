import type { Session } from "next-auth";
import type { OrderChannel, UserRole } from "@prisma/client";

/**
 * Single place that turns "who is looking" into "which pricing channel".
 * B2C-EXPANSION-PLAN.md's brief: "session se channel nikalo ... ye helper har
 * jagah use ho, role check bikhra hua nahi" — every storefront/cart/order
 * surface must call this instead of re-deriving DEALER/CUSTOMER checks
 * inline. Returns null for any role that never places an order itself
 * (ADMIN/STAFF/VENDOR browsing, or no session at all).
 */
export function channelForRole(role: UserRole | string | null | undefined): OrderChannel | null {
  if (role === "DEALER") return "B2B";
  if (role === "CUSTOMER") return "B2C";
  return null;
}

/**
 * What a viewer should be *shown* on the storefront — distinct from
 * channelForRole because a guest (no session) still sees B2B (wholesale)
 * pricing today, a deliberate business call (commit 7ec1eb6): struck-through
 * MRP next to a lower "Dealer Price" is the pitch that gets a visitor to sign
 * up as a dealer. Only a logged-in CUSTOMER gets the B2C (MRP-only) view;
 * every other viewer — guest, dealer, admin/staff previewing the storefront —
 * sees the existing B2B display.
 */
export function displayChannel(session: Session | null): OrderChannel {
  return session?.user?.role === "CUSTOMER" ? "B2C" : "B2B";
}
