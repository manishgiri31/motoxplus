import { z } from "zod";
import { DelhiveryConfigError } from "./errors";

/**
 * The two Delhivery clients we ship through. Each has its own API token and its
 * own registered pickup location. Mirrors Order.channel (prisma OrderChannel).
 */
export type DelhiveryChannel = "B2C" | "B2B";

/**
 * Per-channel env var names, in priority order (first non-empty wins).
 * B2C keeps the pre-channel names as a fallback so the existing production
 * .env keeps working until the new vars are set. B2B deliberately has NO
 * fallback: silently using the Domestic (B2C) token for a B2B order would
 * book it on the wrong Delhivery client and wallet.
 */
const CHANNEL_ENV: Record<DelhiveryChannel, { token: string[]; pickupLocation: string[] }> = {
  B2C: {
    token: ["DELHIVERY_TOKEN_B2C", "DELHIVERY_TOKEN"],
    pickupLocation: ["DELHIVERY_PICKUP_LOCATION_B2C", "DELHIVERY_PICKUP_LOCATION_NAME"],
  },
  B2B: {
    token: ["DELHIVERY_TOKEN_B2B"],
    pickupLocation: ["DELHIVERY_PICKUP_LOCATION_B2B"],
  },
};

/** Narrows Order.channel to a DelhiveryChannel; anything else is a bug upstream. */
export function toDelhiveryChannel(value: unknown): DelhiveryChannel {
  if (value === "B2C" || value === "B2B") return value;
  throw new DelhiveryConfigError(`[Delhivery config] Unknown order channel: ${JSON.stringify(value)}`);
}

function firstEnv(names: string[]): { name: string; value: string } | null {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return { name, value };
  }
  return null;
}

const envSchema = z.object({
  DELHIVERY_BASE_URL: z
    .string()
    .trim()
    .min(1)
    .default("https://track.delhivery.com")
    .refine((v) => {
      try {
        new URL(v);
        return true;
      } catch {
        return false;
      }
    }, "DELHIVERY_BASE_URL must be a valid URL"),
  DELHIVERY_PICKUP_NAME: z.string().trim().min(1, "DELHIVERY_PICKUP_NAME is required"),
  DELHIVERY_PICKUP_ADDRESS: z.string().trim().min(1, "DELHIVERY_PICKUP_ADDRESS is required"),
  DELHIVERY_PICKUP_CITY: z.string().trim().min(1, "DELHIVERY_PICKUP_CITY is required"),
  DELHIVERY_PICKUP_STATE: z.string().trim().min(1, "DELHIVERY_PICKUP_STATE is required"),
  DELHIVERY_PICKUP_PHONE: z.string().trim().min(1, "DELHIVERY_PICKUP_PHONE is required"),
  DELHIVERY_ORIGIN_PINCODE: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "DELHIVERY_ORIGIN_PINCODE must be exactly 6 digits"),
  COMPANY_GST: z.string().trim().min(1, "COMPANY_GST is required"),
  DELHIVERY_CLIENT_NAME: z.string().trim().min(1, "DELHIVERY_CLIENT_NAME is required"),
});

export type DelhiveryConfig = {
  channel: DelhiveryChannel;
  token: string;
  baseUrl: string;
  pickup: {
    name: string;
    address: string;
    city: string;
    state: string;
    phone: string;
    pincode: string;
    locationName: string;
  };
  companyGst: string;
  clientName: string;
};

const cached = new Map<DelhiveryChannel, DelhiveryConfig>();

/**
 * Lazily validates and returns the Delhivery config. Deliberately NOT
 * evaluated at module load: this module is pulled in (via the ./client,
 * ./shipment, ./cancel barrel re-exports) by API routes that don't need
 * Delhivery on every request, and `next build`'s "Collecting page data"
 * step imports every route module to inspect it — so a top-level
 * `schema.parse(process.env)` here used to turn a missing runtime secret
 * into a build-time failure. Call this inside a request handler instead of
 * reading a module-level constant.
 */
export function getDelhiveryConfig(channel: DelhiveryChannel = "B2C"): DelhiveryConfig {
  const hit = cached.get(channel);
  if (hit) return hit;

  const parsed = envSchema.safeParse({
    DELHIVERY_BASE_URL: process.env.DELHIVERY_BASE_URL,
    DELHIVERY_PICKUP_NAME: process.env.DELHIVERY_PICKUP_NAME,
    DELHIVERY_PICKUP_ADDRESS: process.env.DELHIVERY_PICKUP_ADDRESS,
    DELHIVERY_PICKUP_CITY: process.env.DELHIVERY_PICKUP_CITY,
    DELHIVERY_PICKUP_STATE: process.env.DELHIVERY_PICKUP_STATE,
    DELHIVERY_PICKUP_PHONE: process.env.DELHIVERY_PICKUP_PHONE,
    DELHIVERY_ORIGIN_PINCODE: process.env.DELHIVERY_ORIGIN_PINCODE,
    COMPANY_GST: process.env.COMPANY_GST,
    DELHIVERY_CLIENT_NAME: process.env.DELHIVERY_CLIENT_NAME,
  });

  const issues = parsed.success
    ? []
    : parsed.error.issues.map((issue) => `${issue.path.join(".") || "(env)"}: ${issue.message}`);

  const wanted = CHANNEL_ENV[channel];
  const token = firstEnv(wanted.token);
  if (!token || token.value.length < 20) {
    issues.push(`${wanted.token[0]}: missing, empty, or under 20 characters (channel ${channel})`);
  }
  // Distinct from DELHIVERY_PICKUP_NAME (which feeds return_name — the RTO/
  // return address contact). This is the immutable registered pickup_location
  // name Delhivery matches against on create.json — a different real value.
  const locationName = firstEnv(wanted.pickupLocation);
  if (!locationName) {
    issues.push(`${wanted.pickupLocation[0]}: is required (channel ${channel})`);
  }

  if (!parsed.success || !token || token.value.length < 20 || !locationName) {
    throw new DelhiveryConfigError(`[Delhivery config] Invalid environment configuration:\n  ${issues.join("\n  ")}`);
  }

  const config: DelhiveryConfig = {
    channel,
    token: token.value,
    baseUrl: parsed.data.DELHIVERY_BASE_URL,
    pickup: {
      name: parsed.data.DELHIVERY_PICKUP_NAME,
      address: parsed.data.DELHIVERY_PICKUP_ADDRESS,
      city: parsed.data.DELHIVERY_PICKUP_CITY,
      state: parsed.data.DELHIVERY_PICKUP_STATE,
      phone: parsed.data.DELHIVERY_PICKUP_PHONE,
      pincode: parsed.data.DELHIVERY_ORIGIN_PINCODE,
      locationName: locationName.value,
    },
    companyGst: parsed.data.COMPANY_GST,
    clientName: parsed.data.DELHIVERY_CLIENT_NAME,
  };

  cached.set(channel, config);
  return config;
}
