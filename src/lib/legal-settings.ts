import { prisma } from "@/lib/prisma";

/**
 * Legal/business identity shown on public legal pages (Terms & Conditions,
 * Privacy, Cancellation Policy). Same Setting-table-first pattern as
 * lib/tax/seller-state.ts: these are business facts (registered address,
 * GSTIN, who the grievance officer is), not deploy config, so an admin
 * should be able to correct one via PUT /api/admin/settings without a
 * redeploy. Each falls back to its existing env var, then to a hardcoded
 * default matching what was previously hardcoded directly into the terms
 * page — a page must never fail to render just because Settings weren't
 * seeded.
 *
 * The grievance officer fields have no env fallback and default to "" on
 * purpose: those details aren't known yet, and the page renders an explicit
 * "to be announced" placeholder for an empty value rather than inventing one.
 */
export interface LegalSettings {
  companyName: string;
  gstin: string;
  registeredAddress: string;
  customerCareEmail: string;
  customerCarePhone: string;
  /** Governing-law jurisdiction (city, state), e.g. "New Delhi, India". */
  jurisdiction: string;
  grievanceOfficerName: string;
  grievanceOfficerEmail: string;
  grievanceOfficerPhone: string;
  /** e.g. "within 30 days", left blank until confirmed. */
  grievanceResponseTime: string;
}

const SETTING_KEYS = {
  companyName: "legal.companyName",
  gstin: "legal.gstin",
  registeredAddress: "legal.registeredAddress",
  customerCareEmail: "legal.customerCareEmail",
  customerCarePhone: "legal.customerCarePhone",
  jurisdiction: "legal.jurisdiction",
  grievanceOfficerName: "legal.grievanceOfficerName",
  grievanceOfficerEmail: "legal.grievanceOfficerEmail",
  grievanceOfficerPhone: "legal.grievanceOfficerPhone",
  grievanceResponseTime: "legal.grievanceResponseTime",
} as const satisfies Record<keyof LegalSettings, string>;

const DEFAULTS: LegalSettings = {
  companyName: process.env.NEXT_PUBLIC_COMPANY_NAME || "MotoXPlus India Private Limited",
  gstin: process.env.COMPANY_GST || process.env.NEXT_PUBLIC_COMPANY_GST || "07AAUCM5765B1Z4",
  registeredAddress:
    process.env.NEXT_PUBLIC_COMPANY_ADDRESS ||
    "Ground Floor, RSR-11, Kh.No.443, Main Nasirpur Road, Palam Village, New Delhi – 110045",
  customerCareEmail: process.env.NEXT_PUBLIC_COMPANY_EMAIL || "info@motoxplus.com",
  customerCarePhone: process.env.NEXT_PUBLIC_COMPANY_PHONE || "+91 88168 12379",
  jurisdiction: "New Delhi, India",
  grievanceOfficerName: "",
  grievanceOfficerEmail: "",
  grievanceOfficerPhone: "",
  grievanceResponseTime: "",
};

const CACHE_TTL_MS = 5 * 60 * 1000;
let cache: { value: LegalSettings; expiresAt: number } | null = null;

export async function getLegalSettings(): Promise<LegalSettings> {
  if (cache && cache.expiresAt > Date.now()) return cache.value;

  const rows = await prisma.setting.findMany({ where: { key: { in: Object.values(SETTING_KEYS) } } });
  const byKey = new Map(rows.map((r) => [r.key, r.value]));

  const value = (Object.keys(SETTING_KEYS) as (keyof LegalSettings)[]).reduce((acc, field) => {
    const stored = byKey.get(SETTING_KEYS[field])?.trim();
    acc[field] = stored || DEFAULTS[field];
    return acc;
  }, {} as LegalSettings);

  cache = { value, expiresAt: Date.now() + CACHE_TTL_MS };
  return value;
}
