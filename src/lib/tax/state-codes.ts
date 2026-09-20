/**
 * Official GST state/UT codes (the first two digits of a GSTIN). Used to
 * decide same-state (CGST+SGST) vs. inter-state (IGST) — comparing on the
 * code, not the raw string, because delivery addresses are free text
 * ("Haryana", "HARYANA", "HR", "delhi ", "NCT of Delhi" all mean the same
 * thing) and a naive string match would silently mis-tax an order whose
 * state was typed differently than the seller's. Andhra Pradesh/Telangana
 * use their current post-2017 codes (37/36); the legacy "28" pre-bifurcation
 * AP code is deliberately not mapped here — it's a taxpayer-record artifact,
 * not a current addressable state.
 */
export const GST_STATE_CODES: Record<string, string> = {
  "JAMMU AND KASHMIR": "01",
  "HIMACHAL PRADESH": "02",
  PUNJAB: "03",
  CHANDIGARH: "04",
  UTTARAKHAND: "05",
  HARYANA: "06",
  DELHI: "07",
  RAJASTHAN: "08",
  "UTTAR PRADESH": "09",
  BIHAR: "10",
  SIKKIM: "11",
  "ARUNACHAL PRADESH": "12",
  NAGALAND: "13",
  MANIPUR: "14",
  MIZORAM: "15",
  TRIPURA: "16",
  MEGHALAYA: "17",
  ASSAM: "18",
  "WEST BENGAL": "19",
  JHARKHAND: "20",
  ODISHA: "21",
  CHHATTISGARH: "22",
  "MADHYA PRADESH": "23",
  GUJARAT: "24",
  "DADRA AND NAGAR HAVELI AND DAMAN AND DIU": "26",
  MAHARASHTRA: "27",
  KARNATAKA: "29",
  GOA: "30",
  LAKSHADWEEP: "31",
  KERALA: "32",
  "TAMIL NADU": "33",
  PUDUCHERRY: "34",
  "ANDAMAN AND NICOBAR ISLANDS": "35",
  TELANGANA: "36",
  "ANDHRA PRADESH": "37",
  LADAKH: "38",
};

/** Alternate spellings/abbreviations/old names, normalized to a canonical key above. */
const ALIASES: Record<string, string> = {
  "J AND K": "JAMMU AND KASHMIR",
  JK: "JAMMU AND KASHMIR",
  HP: "HIMACHAL PRADESH",
  PB: "PUNJAB",
  CH: "CHANDIGARH",
  UK: "UTTARAKHAND",
  UA: "UTTARAKHAND",
  UTTARANCHAL: "UTTARAKHAND",
  HR: "HARYANA",
  DL: "DELHI",
  "NCT OF DELHI": "DELHI",
  "NEW DELHI": "DELHI",
  "NATIONAL CAPITAL TERRITORY OF DELHI": "DELHI",
  RJ: "RAJASTHAN",
  UP: "UTTAR PRADESH",
  BR: "BIHAR",
  SK: "SIKKIM",
  AR: "ARUNACHAL PRADESH",
  NL: "NAGALAND",
  MN: "MANIPUR",
  MZ: "MIZORAM",
  TR: "TRIPURA",
  ML: "MEGHALAYA",
  AS: "ASSAM",
  WB: "WEST BENGAL",
  JH: "JHARKHAND",
  OD: "ODISHA",
  OR: "ODISHA",
  ORISSA: "ODISHA",
  CG: "CHHATTISGARH",
  CT: "CHHATTISGARH",
  MP: "MADHYA PRADESH",
  GJ: "GUJARAT",
  DNH: "DADRA AND NAGAR HAVELI AND DAMAN AND DIU",
  DD: "DADRA AND NAGAR HAVELI AND DAMAN AND DIU",
  "DADRA AND NAGAR HAVELI": "DADRA AND NAGAR HAVELI AND DAMAN AND DIU",
  "DAMAN AND DIU": "DADRA AND NAGAR HAVELI AND DAMAN AND DIU",
  MH: "MAHARASHTRA",
  KA: "KARNATAKA",
  GA: "GOA",
  LD: "LAKSHADWEEP",
  KL: "KERALA",
  TN: "TAMIL NADU",
  PY: "PUDUCHERRY",
  PONDICHERRY: "PUDUCHERRY",
  AN: "ANDAMAN AND NICOBAR ISLANDS",
  "ANDAMAN AND NICOBAR": "ANDAMAN AND NICOBAR ISLANDS",
  TS: "TELANGANA",
  TG: "TELANGANA",
  AP: "ANDHRA PRADESH",
  LA: "LADAKH",
};

function normalizeKey(input: string): string {
  return input
    .trim()
    .toUpperCase()
    .replace(/&/g, "AND")
    .replace(/[.,]/g, "")
    .replace(/\s+/g, " ");
}

/** Resolves free-text state input to its 2-digit GST state code, or null if unrecognized. */
export function resolveGstStateCode(input: string): string | null {
  const key = normalizeKey(input);
  if (GST_STATE_CODES[key]) return GST_STATE_CODES[key];
  const aliased = ALIASES[key];
  if (aliased) return GST_STATE_CODES[aliased] ?? null;
  return null;
}
