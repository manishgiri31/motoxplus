import type { Prisma } from "@prisma/client";
import { isWellFormedGstin, normalizeGstin } from "./gstin";
import { verifyGstin } from "./verify-gstin";

/**
 * The B2B half of registration: a dealer (B2B) account must carry a GSTIN that
 * is well-formed AND not known to the GST registry as invalid/inactive. Shared
 * by POST /api/auth/register (web + mobile app) and POST /api/dealer/register.
 *
 * Messages all mention "GST" so the web form's mapServerError() puts them on
 * the GSTIN field.
 */
export type DealerGstinResult =
  | { ok: true; gstin: string; dealerFields: Pick<Prisma.DealerUncheckedCreateInput, DealerGstinField> }
  | { ok: false; error: string; status: number };

type DealerGstinField =
  | "gstNumber"
  | "gstVerified"
  | "gstVerifiedAt"
  | "gstVerificationStatus"
  | "gstVerificationSource"
  | "gstLegalName"
  | "gstTradeName"
  | "gstRegistrationStatus"
  | "gstPrincipalAddress"
  | "gstLastCheckedAt"
  | "gstCheckAttempts";

export const GSTIN_REQUIRED_MESSAGE =
  "GSTIN is required for a dealer (B2B) account. Without a GST registration, sign up as a Customer instead.";

export async function checkDealerGstin(raw: string, verify = verifyGstin): Promise<DealerGstinResult> {
  const gstin = normalizeGstin(raw);
  if (!gstin) return { ok: false, error: GSTIN_REQUIRED_MESSAGE, status: 400 };
  if (!isWellFormedGstin(gstin)) return { ok: false, error: "Invalid GST number", status: 400 };

  const check = await verify(gstin);
  if (check.status === "INVALID") {
    return { ok: false, error: "This GST number is not registered on the GST portal. Please check it.", status: 400 };
  }
  if (check.status === "INACTIVE") {
    const state = check.registrationStatus ? check.registrationStatus.toLowerCase() : "not active";
    return {
      ok: false,
      error: `This GST number is ${state} on the GST portal. Only an active GST registration can open a dealer account.`,
      status: 400,
    };
  }

  const verified = check.status === "VERIFIED";
  const now = new Date();
  return {
    ok: true,
    gstin,
    dealerFields: {
      gstNumber: gstin,
      gstVerified: verified,
      gstVerifiedAt: verified ? now : null,
      // PENDING = registry unreachable right now; backend-java GstinRecheckJob retries.
      gstVerificationStatus: check.status,
      gstVerificationSource: verified ? "GST_API" : null,
      gstLegalName: check.legalName,
      gstTradeName: check.tradeName,
      gstRegistrationStatus: check.registrationStatus,
      gstPrincipalAddress: check.principalAddress,
      gstLastCheckedAt: verified ? now : null,
      gstCheckAttempts: verified ? 1 : 0,
    },
  };
}
