// Single source of truth for "what is an acceptable new password" — shared by
// the register + reset-password routes and by the register/reset forms'
// live checklist, so the UI can never promise something the server rejects
// (register used to accept any 8 characters while reset-password demanded
// upper + lower + digit). Pure and dependency-free so it's safe to import
// from client components.

export const PASSWORD_MIN_LENGTH = 8;
// bcrypt only reads the first 72 bytes; anything past that is silently
// ignored (two different 100-char passwords could hash identically) and an
// unbounded input is a free CPU-burn vector. Cap in bytes, not characters.
export const PASSWORD_MAX_BYTES = 72;

export interface PasswordRule {
  id: "length" | "upper" | "lower" | "digit";
  label: string;
  met: boolean;
}

export interface PasswordEvaluation {
  rules: PasswordRule[];
  /** Every hard rule met (length, upper, lower, digit). */
  meetsRules: boolean;
  /** 0 = nothing typed, 1 = weak, 2 = fair, 3 = good, 4 = strong. */
  score: 0 | 1 | 2 | 3 | 4;
  label: "" | "Weak" | "Fair" | "Good" | "Strong";
}

// Deliberately short: this is not a breach corpus, just the handful of
// passwords that satisfy "8 chars + upper + lower + digit" and are still the
// first things any guesser tries.
const COMMON_PASSWORDS = new Set([
  "password1", "password12", "password123", "password1234", "passw0rd", "p@ssw0rd", "p@ssword1",
  "qwerty123", "qwerty1234", "qwertyuiop1", "1qaz2wsx", "abcd1234", "abc12345", "abcd@1234",
  "welcome1", "welcome123", "admin123", "admin@123", "admin1234", "letmein123", "iloveyou1",
  "india123", "india@123", "india1234", "dealer123", "dealer@123", "12345678", "123456789", "1234567890",
]);

export function evaluatePassword(password: string): PasswordEvaluation {
  const rules: PasswordRule[] = [
    { id: "length", label: `At least ${PASSWORD_MIN_LENGTH} characters`, met: password.length >= PASSWORD_MIN_LENGTH },
    { id: "upper", label: "One uppercase letter", met: /[A-Z]/.test(password) },
    { id: "lower", label: "One lowercase letter", met: /[a-z]/.test(password) },
    { id: "digit", label: "One number", met: /\d/.test(password) },
  ];
  const meetsRules = rules.every((r) => r.met);

  let score: PasswordEvaluation["score"] = 0;
  if (password.length > 0) {
    const metCount = rules.filter((r) => r.met).length;
    if (!meetsRules) score = metCount >= 3 ? 2 : 1;
    else score = password.length >= 12 && /[^A-Za-z0-9]/.test(password) ? 4 : password.length >= 12 || /[^A-Za-z0-9]/.test(password) ? 3 : 2;
    if (isGuessable(password)) score = 1;
  }
  const label = (["", "Weak", "Fair", "Good", "Strong"] as const)[score];
  return { rules, meetsRules, score, label };
}

function isGuessable(password: string, context?: { email?: string | null; name?: string | null }): boolean {
  const lower = password.toLowerCase();
  if (COMMON_PASSWORDS.has(lower)) return true;
  if (lower.includes("motoxplus")) return true;
  const emailLocal = context?.email?.split("@")[0]?.toLowerCase();
  if (emailLocal && emailLocal.length >= 4 && lower.includes(emailLocal)) return true;
  const firstName = context?.name?.trim().split(/\s+/)[0]?.toLowerCase();
  if (firstName && firstName.length >= 4 && lower.includes(firstName)) return true;
  return false;
}

/**
 * Server-side gate. Returns a user-facing message, or null when acceptable.
 * `context` lets the caller reject a password built from the account's own
 * email/name (the first thing a targeted guess tries).
 */
export function validateNewPassword(
  password: unknown,
  context?: { email?: string | null; name?: string | null }
): string | null {
  if (typeof password !== "string" || password.length === 0) return "Password is required";
  if (new TextEncoder().encode(password).length > PASSWORD_MAX_BYTES) {
    return `Password must be at most ${PASSWORD_MAX_BYTES} bytes long`;
  }
  const { meetsRules } = evaluatePassword(password);
  if (!meetsRules) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters and include an uppercase letter, a lowercase letter, and a number`;
  }
  if (isGuessable(password, context)) {
    return "That password is too easy to guess. Choose something less predictable.";
  }
  return null;
}
