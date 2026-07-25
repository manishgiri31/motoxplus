const MOBILE_REGEX = /^[6-9]\d{9}$/;

/**
 * Normalizes an Indian mobile number to its bare 10-digit form (e.g. "9876543210").
 * Accepts +91, 91 (with country code), a leading 0 (landline-dialing habit),
 * and surrounding/embedded spaces or hyphens. Returns null if the input doesn't
 * resolve to a valid Indian mobile number.
 *
 * The previous ad-hoc `.replace(/\s/g, "").replace("+91", "")` (duplicated across
 * several routes) only stripped a literal "+91" prefix — a number typed as
 * "919876543210" (country code, no +) or "09876543210" (leading 0) was rejected
 * as "invalid" even though it's a legitimate way to enter the same number.
 */
export function normalizeIndianMobile(input: string): string | null {
  if (!input) return null;
  let digits = input.trim().replace(/[\s-]/g, "");

  if (digits.startsWith("+91")) {
    digits = digits.slice(3);
  } else if (digits.startsWith("91") && digits.length === 12) {
    digits = digits.slice(2);
  } else if (digits.startsWith("0") && digits.length === 11) {
    digits = digits.slice(1);
  }

  return MOBILE_REGEX.test(digits) ? digits : null;
}
