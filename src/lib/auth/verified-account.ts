import { prisma } from "@/lib/prisma";

/**
 * Full-account guard for dealer/vendor mutations that create real orders,
 * payments, or payment submissions. A correct password always issues a
 * session (see src/lib/auth.ts) — email/mobile verification and admin
 * approval are enforced by page middleware, which never covers /api/*.
 * Routes that move money or create fulfillable orders must call one of
 * these instead of a bare dealer/vendor lookup by userId.
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
  "Your account is not verified or approved yet. Please complete verification and wait for admin approval before continuing.";
