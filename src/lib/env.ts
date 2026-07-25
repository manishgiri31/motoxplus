/**
 * Runtime environment validation.
 * Imported by prisma.ts and auth.ts so it runs on every cold start.
 * The application will throw immediately if any required variable is absent,
 * making misconfigurations obvious rather than causing subtle failures at runtime.
 */

// Razorpay isn't wired up on the merchant account yet — RAZORPAY_ENABLED
// gates both the checkout UI (src/app/dealer/checkout/page.tsx) and the
// order-creation endpoint (src/app/api/payments/create-order/route.ts).
// While disabled, its keys are optional; flipping the flag to "true" makes
// them required again with no other code changes.
const RAZORPAY_ENABLED = process.env.NEXT_PUBLIC_RAZORPAY_ENABLED === "true";

const REQUIRED_SERVER: string[] = [
  "DATABASE_URL",
  "NEXTAUTH_URL",
  "NEXTAUTH_SECRET",
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
  "R2_PUBLIC_URL",
  "JWT_SECRET",
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "ENCRYPTION_KEY",
  ...(RAZORPAY_ENABLED ? ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"] : []),
];

const REQUIRED_PUBLIC: string[] = [
  "NEXT_PUBLIC_APP_URL",
  ...(RAZORPAY_ENABLED ? ["NEXT_PUBLIC_RAZORPAY_KEY_ID"] : []),
];

/**
 * Pure check (no throw) so callers — instrumentation.ts's true boot hook, in
 * particular — can decide how to report/exit themselves instead of catching
 * a thrown Error.
 */
export function getMissingEnvVars(): string[] {
  const missing: string[] = [];

  for (const key of REQUIRED_SERVER) {
    const val = process.env[key];
    if (!val || val.trim() === "" || val.startsWith("replace_with") || val.startsWith("your_")) {
      missing.push(key);
    }
  }

  for (const key of REQUIRED_PUBLIC) {
    const val = process.env[key];
    if (!val || val.trim() === "") {
      missing.push(key);
    }
  }

  return missing;
}

function validateEnv() {
  const missing = getMissingEnvVars();
  if (missing.length > 0) {
    throw new Error(
      `[env] Missing or placeholder environment variable(s):\n  ${missing.join("\n  ")}\n\n` +
      `Copy .env.example to .env and fill in real values.\n`
    );
  }
}

// Only validate in server-side contexts (not during Next.js edge runtime or browser builds)
if (typeof window === "undefined" && process.env.NODE_ENV !== "test") {
  try {
    validateEnv();
  } catch (err) {
    // In development we warn but don't crash (allows gradual setup)
    if (process.env.NODE_ENV === "production") {
      throw err;
    } else {
      console.warn(String(err));
    }
  }
}

export const env = {
  DATABASE_URL: process.env.DATABASE_URL!,
  NEXTAUTH_URL: process.env.NEXTAUTH_URL!,
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET!,
  RAZORPAY_ENABLED,
  // Empty string (not `!`) when disabled — Razorpay isn't configured yet, so
  // these are legitimately absent rather than a misconfiguration.
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID ?? "",
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET ?? "",
  R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID!,
  R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID!,
  R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY!,
  R2_BUCKET_NAME: process.env.R2_BUCKET_NAME!,
  R2_PUBLIC_URL: process.env.R2_PUBLIC_URL!,
  JWT_SECRET: process.env.JWT_SECRET!,
  RESEND_API_KEY: process.env.RESEND_API_KEY!,
  EMAIL_FROM: process.env.EMAIL_FROM!,
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY!,
  REDIS_URL: process.env.REDIS_URL,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? "https://motoxplus.com",
  NEXT_PUBLIC_RAZORPAY_KEY_ID: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? "",
  NODE_ENV: process.env.NODE_ENV as "development" | "production" | "test",
  isDev: process.env.NODE_ENV === "development",
  isProd: process.env.NODE_ENV === "production",
} as const;
