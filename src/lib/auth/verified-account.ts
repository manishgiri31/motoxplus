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

export const ACCOUNT_NOT_VERIFIED_MESSAGE =
  "Your account is not verified or is not active. Please complete email and mobile verification, or contact support if your account has been suspended.";
