import { z } from "zod";
import { DelhiveryConfigError } from "./errors";

const envSchema = z.object({
  DELHIVERY_TOKEN: z
    .string()
    .trim()
    .min(20, "DELHIVERY_TOKEN is missing, empty, or under 20 characters"),
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
  // Distinct from DELHIVERY_PICKUP_NAME (which feeds return_name — the RTO/
  // return address contact). This is the immutable registered pickup_location
  // name Delhivery matches against on create.json — a different real value.
  DELHIVERY_PICKUP_LOCATION_NAME: z.string().trim().min(1, "DELHIVERY_PICKUP_LOCATION_NAME is required"),
});

export type DelhiveryConfig = {
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

let cached: DelhiveryConfig | null = null;

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
export function getDelhiveryConfig(): DelhiveryConfig {
  if (cached) return cached;

  const parsed = envSchema.safeParse({
    DELHIVERY_TOKEN: process.env.DELHIVERY_TOKEN,
    DELHIVERY_BASE_URL: process.env.DELHIVERY_BASE_URL,
    DELHIVERY_PICKUP_NAME: process.env.DELHIVERY_PICKUP_NAME,
    DELHIVERY_PICKUP_ADDRESS: process.env.DELHIVERY_PICKUP_ADDRESS,
    DELHIVERY_PICKUP_CITY: process.env.DELHIVERY_PICKUP_CITY,
    DELHIVERY_PICKUP_STATE: process.env.DELHIVERY_PICKUP_STATE,
    DELHIVERY_PICKUP_PHONE: process.env.DELHIVERY_PICKUP_PHONE,
    DELHIVERY_ORIGIN_PINCODE: process.env.DELHIVERY_ORIGIN_PINCODE,
    COMPANY_GST: process.env.COMPANY_GST,
    DELHIVERY_CLIENT_NAME: process.env.DELHIVERY_CLIENT_NAME,
    DELHIVERY_PICKUP_LOCATION_NAME: process.env.DELHIVERY_PICKUP_LOCATION_NAME,
  });

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "(env)"}: ${issue.message}`)
      .join("\n  ");
    throw new DelhiveryConfigError(`[Delhivery config] Invalid environment configuration:\n  ${issues}`);
  }

  cached = {
    token: parsed.data.DELHIVERY_TOKEN,
    baseUrl: parsed.data.DELHIVERY_BASE_URL,
    pickup: {
      name: parsed.data.DELHIVERY_PICKUP_NAME,
      address: parsed.data.DELHIVERY_PICKUP_ADDRESS,
      city: parsed.data.DELHIVERY_PICKUP_CITY,
      state: parsed.data.DELHIVERY_PICKUP_STATE,
      phone: parsed.data.DELHIVERY_PICKUP_PHONE,
      pincode: parsed.data.DELHIVERY_ORIGIN_PINCODE,
      locationName: parsed.data.DELHIVERY_PICKUP_LOCATION_NAME,
    },
    companyGst: parsed.data.COMPANY_GST,
    clientName: parsed.data.DELHIVERY_CLIENT_NAME,
  };

  return cached;
}
