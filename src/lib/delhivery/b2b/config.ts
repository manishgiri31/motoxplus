import { DelhiveryConfigError } from "../errors";

const DEFAULT_BASE_URL = "https://ltl-clients-api.delhivery.com";

export interface B2bConfig {
  /** ltl-clients-api origin (no trailing slash). Never track.delhivery.com. */
  baseUrl: string;
  username: string;
  password: string;
  /** Registered warehouse name: manifest `pickup_location_name` AND pickup `client_warehouse`. */
  pickupLocationName: string;
  /** True when baseUrl is the production LTL host (anything else is dev/test). */
  isProd: boolean;
  /**
   * Operator confirmation that a manifest has been accepted on the DEV host
   * (a job_id came back). Until true, manifests are refused on the prod host.
   */
  prodManifestVerified: boolean;
  /**
   * Retail / co-loader account. Only then is `rov_insurance` sent on the
   * manifest; for everyone else the key is omitted entirely. Default false.
   */
  retailColoader: boolean;
  /** Value for `rov_insurance` — required (and only used) when retailColoader is true. */
  rovInsurance: string | null;
}

export const B2B_PROD_HOST = "ltl-clients-api.delhivery.com";

function envFlag(name: string): boolean {
  return env(name).toLowerCase() === "true";
}

function env(name: string): string {
  return process.env[name]?.trim() ?? "";
}

/**
 * Read lazily (not at module load) for the same reason as getDelhiveryConfig:
 * `next build` imports every route module. Not cached — env reads are cheap
 * and it keeps tests simple.
 *
 * DELHIVERY_B2B_BASE_URL exists so the dev host can be selected; the default is
 * the production host from the B2B docs. B2B traffic must never reach the B2C
 * host, so that is enforced here rather than trusted.
 */
export function getB2bConfig(): B2bConfig {
  const issues: string[] = [];

  const rawBase = env("DELHIVERY_B2B_BASE_URL") || DEFAULT_BASE_URL;
  let baseUrl = rawBase.replace(/\/+$/, "");
  try {
    const u = new URL(baseUrl);
    if (u.protocol !== "https:") issues.push("DELHIVERY_B2B_BASE_URL: must be https");
    if (u.hostname === "track.delhivery.com" || u.hostname.endsWith(".track.delhivery.com")) {
      issues.push("DELHIVERY_B2B_BASE_URL: B2B requests must never go to track.delhivery.com (that is the B2C API)");
    }
    baseUrl = u.origin;
  } catch {
    issues.push("DELHIVERY_B2B_BASE_URL: must be a valid URL");
  }

  const username = env("DELHIVERY_USERNAME_B2B");
  const password = env("DELHIVERY_PASSWORD_B2B");
  const pickupLocationName = env("DELHIVERY_PICKUP_LOCATION_B2B");
  if (!username) issues.push("DELHIVERY_USERNAME_B2B: is required");
  if (!password) issues.push("DELHIVERY_PASSWORD_B2B: is required");
  if (!pickupLocationName) issues.push("DELHIVERY_PICKUP_LOCATION_B2B: is required");

  const retailColoader = envFlag("DELHIVERY_B2B_RETAIL_COLOADER");
  const rovInsurance = env("DELHIVERY_B2B_ROV_INSURANCE");
  // The accepted values for rov_insurance are not in the spec we hold, so the
  // value is supplied by the operator rather than hardcoded.
  if (retailColoader && !rovInsurance) {
    issues.push("DELHIVERY_B2B_ROV_INSURANCE: is required when DELHIVERY_B2B_RETAIL_COLOADER=true");
  }

  if (issues.length > 0) {
    throw new DelhiveryConfigError(`[Delhivery B2B config] Invalid environment configuration:\n  ${issues.join("\n  ")}`);
  }

  return {
    baseUrl,
    username,
    password,
    pickupLocationName,
    isProd: new URL(baseUrl).hostname === B2B_PROD_HOST,
    prodManifestVerified: envFlag("DELHIVERY_B2B_PROD_MANIFEST_VERIFIED"),
    retailColoader,
    rovInsurance: retailColoader ? rovInsurance : null,
  };
}
