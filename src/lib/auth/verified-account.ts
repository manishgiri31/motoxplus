import { prisma } from "@/lib/prisma";

/**
 * Full-account guard for dealer/vendor mutations that create real orders,
 * payments, or payment submissions. A correct password always issues a
 * session (see src/lib/auth.ts) — email/mobile verification and account
 * standing are enforced by page middleware, which never covers /api/*.
 * Routes that move money or create fulfillable orders must call one of
 * these instead of a bare dealer/vendor lookup by userId.
 *
 * Dealers no longer need sign-up approval: a verified dealer is ACTIVE by
 * default, so this check only rejects accounts an admin has SUSPENDED/REJECTED.
 * Vendors still require admin approval (status APPROVED).
 */
export async function getVerifiedDealer(userId: string) {
  const dealer = await prisma.dealer.findUnique({
    where: { userId },
    include: { user: true },
  });
  if (!dealer) return null;
  if (!dealer.user.isActive) return null;
  if (!dealer.user.emailVerified) return null;
  if (!dealer.user.mobileVerified) return null;
  if (dealer.status !== "ACTIVE") return null;
  return dealer;
}

export async function getVerifiedVendor(userId: string) {
  const vendor = await prisma.vendor.findUnique({ where: { userId } });
  if (!vendor) return null;
  if (vendor.status !== "APPROVED") return null;
  return vendor;
}

// B2C customers have no approval step and no email-verification requirement
// (signup is phone-OTP only, see /api/auth/customer/register) — only
// mobileVerified + isActive gate order-placing/payment routes, mirroring
// getVerifiedDealer's shape but without the email/dealerStatus checks.
export async function getVerifiedCustomer(userId: string) {
  const customer = await prisma.customer.findUnique({
    where: { userId },
    include: { user: true },
  });
  if (!customer) return null;
  if (!customer.user.isActive) return null;
  if (!customer.user.mobileVerified) return null;
  return customer;
}

export const ACCOUNT_NOT_VERIFIED_MESSAGE =
  "Your account is not verified or is not active. Please complete email and mobile verification, or contact support if your account has been suspended.";

export type OrderActor =
  | { channel: "B2B"; dealer: NonNullable<Awaited<ReturnType<typeof getVerifiedDealer>>> }
  | { channel: "B2C"; customer: NonNullable<Awaited<ReturnType<typeof getVerifiedCustomer>>> };

/**
 * Single lookup every cart/order/payment route calls instead of its own
 * `role !== "DEALER"` + getVerifiedDealer() pair (B2C-EXPANSION-PLAN.md
 * Phase 2 — "role check bikhra hua nahi"). Returns null for anyone who isn't
 * a verified dealer or verified customer — an unverified/suspended account of
 * either kind, or any other role (ADMIN/STAFF/VENDOR) trying to place an
 * order.
 */
export async function resolveOrderActor(userId: string): Promise<OrderActor | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!user) return null;

  if (user.role === "DEALER") {
    const dealer = await getVerifiedDealer(userId);
    return dealer ? { channel: "B2B", dealer } : null;
  }
  if (user.role === "CUSTOMER") {
    const customer = await getVerifiedCustomer(userId);
    return customer ? { channel: "B2C", customer } : null;
  }
  return null;
}
