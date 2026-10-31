import { DelhiveryConfigError } from "../errors";

const DEFAULT_BASE_URL = "https://ltl-clients-api.delhivery.com";

export interface B2bConfig {
  /** ltl-clients-api origin (no trailing slash). Never track.delhivery.com. */
  baseUrl: string;
  username: string;
  password: string;
  /**
   * Name (dot path allowed, e.g. "data.jwt") of the JWT field in the
   * POST /ums/login response. Deliberately an env var, not a constant: the
   * field name is not in any spec we hold, so it is set from a real response.
   */
  tokenField: string | null;
  /** Manifest `pickup_location_name`. */
  pickupLocationName: string;
  /** Pickup request `client_warehouse` (defaults to the same registered name). */
  clientWarehouse: string;
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

  const username = env("DELHIVERY_B2B_USERNAME");
  const password = env("DELHIVERY_B2B_PASSWORD");
  const pickupLocationName = env("DELHIVERY_PICKUP_LOCATION_B2B");
  if (!username) issues.push("DELHIVERY_B2B_USERNAME: is required");
  if (!password) issues.push("DELHIVERY_B2B_PASSWORD: is required");
  if (!pickupLocationName) issues.push("DELHIVERY_PICKUP_LOCATION_B2B: is required");

  if (issues.length > 0) {
    throw new DelhiveryConfigError(`[Delhivery B2B config] Invalid environment configuration:\n  ${issues.join("\n  ")}`);
  }

  return {
    baseUrl,
    username,
    password,
    tokenField: env("DELHIVERY_B2B_TOKEN_FIELD") || null,
    pickupLocationName,
    clientWarehouse: env("DELHIVERY_B2B_CLIENT_WAREHOUSE") || pickupLocationName,
  };
}
