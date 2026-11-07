/**
 * Vendor business rules shared by the onboarding screens (src/components/vendor/onboarding). The Java API
 * (com.motoxplus.api.vendor.onboarding.business.BusinessDetailsService) applies the same rules with the same
 * messages and is authoritative; these exist so a form can point at a mistake before a round trip.
 */
import { z } from "zod";

// ───────────────────────── options ─────────────────────────

export const BUSINESS_TYPES = [
  { value: "MANUFACTURER", label: "Manufacturer" },
  { value: "WHOLESALER", label: "Wholesaler" },
  { value: "DISTRIBUTOR", label: "Distributor" },
  { value: "STOCKIST", label: "Stockist" },
  { value: "RETAILER", label: "Retailer" },
  { value: "OTHER", label: "Other" },
] as const;

export const INDIAN_STATES = [
  "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chandigarh",
  "Chhattisgarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa", "Gujarat", "Haryana",
  "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand", "Karnataka", "Kerala", "Ladakh", "Lakshadweep",
  "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Puducherry",
  "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand",
  "West Bengal",
] as const;

// ───────────────────────── field rules ─────────────────────────

export const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
export const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;
export const PINCODE_REGEX = /^[1-9][0-9]{5}$/;
export const ACCOUNT_NUMBER_REGEX = /^[0-9]{9,18}$/;

const text = (label: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min, min <= 1 ? `${label} is required` : `${label} must be at least ${min} characters`)
    .max(max, `${label} must be at most ${max} characters`);

const upper = (v: unknown) => (typeof v === "string" ? v.trim().toUpperCase() : v);

// ───────────────────────── business details ─────────────────────────

export const businessSchema = z
  .object({
    businessName: text("Business name", 2, 150),
    businessType: z.enum(["MANUFACTURER", "WHOLESALER", "DISTRIBUTOR", "STOCKIST", "RETAILER", "OTHER"], {
      error: "Select your business type",
    }),
    pan: z.preprocess(upper, z.string().min(1, "Business PAN is required").regex(PAN_REGEX, "PAN looks like ABCDE1234F")),
    gstin: z.preprocess(upper, z.string().regex(GSTIN_REGEX, "Enter a valid 15-character GSTIN").or(z.literal(""))),
    address: text("Business address", 8, 300),
    state: z.string().min(1, "Select a state"),
    city: text("City", 2, 80),
    pincode: z.string().trim().regex(PINCODE_REGEX, "Enter a valid 6-digit pincode"),
  })
  .superRefine((v, ctx) => {
    // Characters 3-12 of a GSTIN are the holder's PAN, so a mismatch is a typo or the wrong PAN.
    if (v.gstin && PAN_REGEX.test(v.pan) && v.gstin.slice(2, 12) !== v.pan) {
      ctx.addIssue({ code: "custom", path: ["gstin"], message: "This GSTIN does not belong to the PAN you entered" });
    }
  });
