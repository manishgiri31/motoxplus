import { z } from "zod";
import { INDIAN_STATES } from "@/lib/seller/registration";
import { normalizeIndianMobile, isPlaceholderEmail } from "@/lib/phone";

// Customer (B2C) signup contract, shared by the /signup form and
// /api/auth/customer/register so the two can't drift on what "valid" means.

export { INDIAN_STATES };

export const PINCODE_REGEX = /^[1-9]\d{5}$/;

export const signupDetailsSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(100),
  phone: z
    .string()
    .trim()
    .refine((v) => normalizeIndianMobile(v) !== null, "Enter a valid 10-digit mobile number"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Enter a valid email address")
    .max(254)
    .refine((v) => !isPlaceholderEmail(v), "Enter a valid email address"),
  address: z.string().trim().min(5, "Enter house number, street and area").max(300),
  city: z.string().trim().min(2, "Enter your city").max(100),
  state: z.enum(INDIAN_STATES, { message: "Choose your state" }),
  pincode: z.string().trim().regex(PINCODE_REGEX, "Enter a 6-digit pincode"),
});

export type SignupDetails = z.infer<typeof signupDetailsSchema>;
export type SignupField = keyof SignupDetails;

/** First error per field, for inline form messages. */
export function fieldErrors(error: z.ZodError): Partial<Record<SignupField, string>> {
  const out: Partial<Record<SignupField, string>> = {};
  for (const issue of error.issues) {
    const key = issue.path[0] as SignupField | undefined;
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}

/** "rahul.k@gmail.com" → "ra•••••@gmail.com". Never echo a full address back on screen. */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"•".repeat(Math.max(3, local.length - visible.length))}@${domain}`;
}

/**
 * Maps whatever spelling a geocoder returns ("NCT of Delhi", "Orissa") onto
 * the state list the form offers. Undefined when nothing matches; the
 * customer then picks it by hand.
 */
const STATE_ALIASES: Record<string, (typeof INDIAN_STATES)[number]> = {
  "nct of delhi": "Delhi",
  "national capital territory of delhi": "Delhi",
  orissa: "Odisha",
  pondicherry: "Puducherry",
  "jammu & kashmir": "Jammu and Kashmir",
  "andaman & nicobar islands": "Andaman and Nicobar Islands",
  "dadra and nagar haveli": "Dadra and Nagar Haveli and Daman and Diu",
  "daman and diu": "Dadra and Nagar Haveli and Daman and Diu",
};

export function matchIndianState(raw: string | undefined | null): (typeof INDIAN_STATES)[number] | undefined {
  if (!raw) return undefined;
  const key = raw.trim().toLowerCase();
  return STATE_ALIASES[key] ?? INDIAN_STATES.find((s) => s.toLowerCase() === key);
}
