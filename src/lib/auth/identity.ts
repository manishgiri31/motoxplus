import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeIndianMobile } from "@/lib/phone";

export type Identifier =
  | { kind: "mobile"; value: string }
  | { kind: "email"; value: string };

// Single place that decides whether a raw identifier string is treated as an
// Indian mobile number or an email — every login/OTP entry point (web REST,
// mobile REST, NextAuth authorize(), login-otp) used to duplicate its own
// ad-hoc version of this check.
export function resolveIdentifier(raw: string): Identifier {
  const mobile = normalizeIndianMobile(raw);
  if (mobile) return { kind: "mobile", value: mobile };
  return { kind: "email", value: raw.trim().toLowerCase() };
}

const USER_WITH_RELATIONS = { dealer: true, vendor: true, admin: true } satisfies Prisma.UserInclude;

export type UserWithRelations = Prisma.UserGetPayload<{ include: typeof USER_WITH_RELATIONS }>;

export function findUserByIdentifier(identifier: Identifier): Promise<UserWithRelations | null> {
  return prisma.user.findUnique({
    where: identifier.kind === "mobile" ? { mobileNumber: identifier.value } : { email: identifier.value },
    include: USER_WITH_RELATIONS,
  });
}

// The claims every authenticated web session (NextAuth token or the bridged
// mx_access/next-auth cookie pair) carries about who the user is and what
// they're allowed to reach — kept in one place so a field added here doesn't
// need to be kept in sync by hand across authorize()/login-otp/REST login.
export function buildSessionClaims(user: UserWithRelations) {
  return {
    id: user.id,
    role: user.role,
    dealerId: user.dealer?.id ?? undefined,
    isSuperAdmin: user.admin?.isSuperAdmin ?? false,
    vendorId: user.vendor?.id ?? undefined,
    department: user.department ?? undefined,
    emailVerified: !!user.emailVerified,
    mobileVerified: user.mobileVerified,
    dealerStatus: user.dealer?.status ?? undefined,
    vendorStatus: user.vendor?.status ?? undefined,
  };
}
