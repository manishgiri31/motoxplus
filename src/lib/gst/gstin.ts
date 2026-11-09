/**
 * GSTIN syntax checks, shared by the dealer registration form and routes.
 * Same rules as backend-java gst/Gstin.java.
 *
 * Passing isWellFormedGstin() only means the number is well-formed. It does
 * NOT mean the GSTIN is registered or active; that needs the live registry
 * check in ./verify-gstin.ts.
 */

const GSTIN_FORMAT = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const CHARSET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function normalizeGstin(raw: string): string {
  return raw.replace(/\s/g, "").toUpperCase();
}

/** GSTN's check-digit algorithm (Luhn mod 36 over the first 14 characters). */
export function gstinCheckChar(first14: string): string {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const product = CHARSET.indexOf(first14[i]) * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(product / 36) + (product % 36);
  }
  return CHARSET[(36 - (sum % 36)) % 36];
}

/** Pattern, state code (01-38, 97, 99) and check digit. */
export function isWellFormedGstin(gstin: string): boolean {
  if (!GSTIN_FORMAT.test(gstin)) return false;
  const state = Number(gstin.slice(0, 2));
  if (!((state >= 1 && state <= 38) || state === 97 || state === 99)) return false;
  return gstinCheckChar(gstin.slice(0, 14)) === gstin[14];
}
