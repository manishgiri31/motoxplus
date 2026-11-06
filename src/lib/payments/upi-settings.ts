/**
 * Pure helpers that turn the raw `Setting` rows for manual UPI / bank-transfer
 * payment into the shapes the order payment route and the admin settings page
 * need.
 *
 * Deliberately NO fallback payee: a missing value stays missing (null / "") so a
 * stale or wrong hard-coded identifier can never silently receive real payments.
 * Callers surface a "not configured" state instead.
 *
 * `upi_enabled` is OPT-IN, interpreted in exactly one place: isUpiFlagEnabled().
 * The platform's payment options are Razorpay full payment (which already offers
 * UPI) or a 20% Razorpay advance with the balance on delivery, so manual UPI /
 * bank transfer is only offered when an admin explicitly switches it on.
 * buildOrderPaymentSettings() still takes the already-resolved boolean.
 */

export const UPI_SETTING_KEYS = [
  "upi_id",
  "upi_name",
  "upi_enabled",
  "bank_account_name",
  "bank_account_number",
  "bank_ifsc",
  "bank_account_type",
] as const;

export const UPI_NOT_CONFIGURED_MESSAGE =
  "Direct UPI isn't available right now. Please pay by bank transfer or contact support.";
export const BANK_NOT_CONFIGURED_MESSAGE =
  "Bank transfer details aren't available right now. Please contact support.";
export const PAYMENT_NOT_CONFIGURED_MESSAGE =
  "Payment details haven't been set up yet. Please contact support to complete this payment.";

const clean = (v: string | undefined | null): string | null => {
  const t = v?.trim();
  return t ? t : null;
};

/**
 * The single definition of the `upi_enabled` default (opt-in): on only when the stored value is
 * exactly "true". Unset, "false", "yes", "TRUE", whitespace... all mean off.
 */
export const isUpiFlagEnabled = (map: Record<string, string>): boolean => map.upi_enabled === "true";

/** True when a settings field has no usable stored value (empty or whitespace). */
export const isNotSet = (v: string | undefined | null): boolean => clean(v) === null;

export interface OrderPaymentSettings {
  upiId: string | null;
  upiName: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  bankIfsc: string | null;
  /** False when the flag is off OR UPI is switched on but upi_id / upi_name are missing. */
  upiEnabled: boolean;
  /** Set when UPI is switched on but cannot be offered because it is not configured. */
  upiMessage: string | null;
  /** Set when any of account name / number / IFSC is missing. */
  bankMessage: string | null;
  /** Set only when NEITHER method can be offered; the page shows it instead of the payment UI. */
  message: string | null;
}

/**
 * @param map            raw Setting rows keyed by Setting.key
 * @param upiFlagEnabled the caller's interpretation of the `upi_enabled` flag
 */
export function buildOrderPaymentSettings(map: Record<string, string>, upiFlagEnabled: boolean): OrderPaymentSettings {
  const upiId = clean(map.upi_id);
  const upiName = clean(map.upi_name);
  const bankAccountName = clean(map.bank_account_name);
  const bankAccountNumber = clean(map.bank_account_number);
  const bankIfsc = clean(map.bank_ifsc);

  const upiConfigured = upiId !== null && upiName !== null;
  const bankConfigured = bankAccountName !== null && bankAccountNumber !== null && bankIfsc !== null;

  const upiEnabled = upiFlagEnabled && upiConfigured;
  const upiMessage = upiFlagEnabled && !upiConfigured ? UPI_NOT_CONFIGURED_MESSAGE : null;
  const bankMessage = bankConfigured ? null : BANK_NOT_CONFIGURED_MESSAGE;
  const message = !upiEnabled && !bankConfigured ? PAYMENT_NOT_CONFIGURED_MESSAGE : null;

  return { upiId, upiName, bankAccountName, bankAccountNumber, bankIfsc, upiEnabled, upiMessage, bankMessage, message };
}

export interface UpiFormValues {
  upiId: string;
  upiName: string;
  upiEnabled: boolean;
  bankAccountName: string;
  bankAccountNumber: string;
  bankIfsc: string;
  bankAccountType: string;
}

/** Admin form initial values: the stored value, or an empty string. Never a default. */
export function toUpiFormInitial(map: Record<string, string>, upiFlagEnabled: boolean): UpiFormValues {
  return {
    upiId: map.upi_id ?? "",
    upiName: map.upi_name ?? "",
    upiEnabled: upiFlagEnabled,
    bankAccountName: map.bank_account_name ?? "",
    bankAccountNumber: map.bank_account_number ?? "",
    bankIfsc: map.bank_ifsc ?? "",
    bankAccountType: map.bank_account_type ?? "",
  };
}
