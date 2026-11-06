/**
 * Marketplace seller registration: field rules, per-step validation, request building and submission.
 *
 * Backend contract (Java, Phase 2 - NOT yet implemented, see docs/marketplace/SELLER-REGISTRATION-API.md):
 *   POST /api/v1/vendors/register   multipart/form-data
 *     payload  (JSON part)  - everything in `RegistrationPayload`
 *     panDocument | gstCertificate | businessProof | bankProof | catalogue   (file parts)
 *   201 -> { userId, vendorId, status, emailVerificationRequired, mobileVerificationRequired }
 *   4xx -> { error, code?, fieldErrors?, retryAfterSeconds? }
 *
 * Rules this module enforces for the UI:
 *  - Nothing is reported as submitted unless the server answered 2xx WITH a userId.
 *  - A missing/unreachable endpoint (404/405/501/502/503/504, network failure) is reported as "unavailable",
 *    never as success, and the in-memory draft is kept so the user loses nothing.
 *  - Sensitive values (password, PAN, bank account) live only in React state / the request; they are never
 *    written to localStorage, sessionStorage, URLs or logs.
 */
import { z } from "zod";
import { ApiError, NetworkError, apiFetch } from "@/lib/api/client";
import { validateNewPassword } from "@/lib/auth/password-policy";
import { normalizeIndianMobile } from "@/lib/phone";
import { MAX_PART_CATEGORY_IDS } from "@/lib/catalog/part-category-selection";
import { VEHICLE_SEGMENT_VALUES } from "@/lib/catalog/vehicle-segments";

// ───────────────────────── options ─────────────────────────

export const BUSINESS_TYPES = [
  { value: "MANUFACTURER", label: "Manufacturer" },
  { value: "WHOLESALER", label: "Wholesaler" },
  { value: "DISTRIBUTOR", label: "Distributor" },
  { value: "STOCKIST", label: "Stockist" },
  { value: "RETAILER", label: "Retailer" },
  { value: "OTHER", label: "Other" },
] as const;

export const VEHICLE_BRANDS = [
  "Hero", "Honda", "Bajaj", "TVS", "Royal Enfield", "Suzuki", "Yamaha", "KTM", "Mahindra", "Other",
] as const;

export const SKU_RANGES = [
  { value: "UNDER_50", label: "Fewer than 50" },
  { value: "50_200", label: "50 – 200" },
  { value: "200_1000", label: "200 – 1,000" },
  { value: "1000_5000", label: "1,000 – 5,000" },
  { value: "OVER_5000", label: "More than 5,000" },
] as const;

export const INDIAN_STATES = [
  "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chandigarh",
  "Chhattisgarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa", "Gujarat", "Haryana",
  "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand", "Karnataka", "Kerala", "Ladakh", "Lakshadweep",
  "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Puducherry",
  "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand",
  "West Bengal",
] as const;

// ───────────────────────── documents ─────────────────────────

export type DocKey = "panDocument" | "gstCertificate" | "businessProof" | "bankProof" | "catalogue";

export const DOC_RULES: Record<DocKey, { label: string; accept: readonly string[]; maxBytes: number }> = {
  panDocument: { label: "PAN document", accept: ["application/pdf", "image/jpeg", "image/png"], maxBytes: 5 * 1024 * 1024 },
  gstCertificate: { label: "GST certificate", accept: ["application/pdf", "image/jpeg", "image/png"], maxBytes: 5 * 1024 * 1024 },
  businessProof: { label: "Business registration proof", accept: ["application/pdf", "image/jpeg", "image/png"], maxBytes: 5 * 1024 * 1024 },
  bankProof: { label: "Cancelled cheque or bank proof", accept: ["application/pdf", "image/jpeg", "image/png"], maxBytes: 5 * 1024 * 1024 },
  catalogue: {
    label: "Product catalogue",
    accept: [
      "application/pdf",
      "text/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ],
    maxBytes: 10 * 1024 * 1024,
  },
};

/** Whole request stays under Nginx's 20 MB body limit with headroom for the JSON part. */
export const MAX_TOTAL_UPLOAD_BYTES = 18 * 1024 * 1024;

export const ACCEPT_ATTR: Record<DocKey, string> = {
  panDocument: ".pdf,.jpg,.jpeg,.png",
  gstCertificate: ".pdf,.jpg,.jpeg,.png",
  businessProof: ".pdf,.jpg,.jpeg,.png",
  bankProof: ".pdf,.jpg,.jpeg,.png",
  catalogue: ".pdf,.csv,.xls,.xlsx",
};

/** Returns an error message, or null when the file is acceptable. UX check only - the server re-validates. */
export function validateDocument(key: DocKey, file: { name: string; size: number; type: string }): string | null {
  const rule = DOC_RULES[key];
  if (file.size === 0) return "This file is empty";
  if (file.size > rule.maxBytes) return `File is too large (max ${Math.round(rule.maxBytes / 1024 / 1024)} MB)`;
  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  const byExt = ACCEPT_ATTR[key].split(",").some((a) => a === `.${ext}`);
  // Browsers sometimes report "" for .csv / .xls; accept on extension when the type is blank.
  const byType = file.type === "" ? byExt : rule.accept.includes(file.type);
  if (!byExt || !byType) return `Unsupported file type. Allowed: ${ACCEPT_ATTR[key].replace(/\./g, "").replace(/,/g, ", ").toUpperCase()}`;
  return null;
}

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
const mobile = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .refine((v) => normalizeIndianMobile(v) !== null, `Enter a valid 10-digit Indian mobile number`);

// ───────────────────────── step schemas ─────────────────────────

export const accountSchema = z
  .object({
    fullName: text("Full name", 2, 100),
    mobile: mobile("Mobile number"),
    email: z.string().trim().toLowerCase().min(1, "Email address is required").max(254).email("Enter a valid email address"),
    password: z.string().min(1, "Password is required"),
    confirmPassword: z.string().min(1, "Confirm your password"),
  })
  .superRefine((v, ctx) => {
    if (v.password) {
      const problem = validateNewPassword(v.password, { email: v.email, name: v.fullName });
      if (problem) ctx.addIssue({ code: "custom", path: ["password"], message: problem });
    }
    if (v.confirmPassword && v.password !== v.confirmPassword) {
      ctx.addIssue({ code: "custom", path: ["confirmPassword"], message: "Passwords do not match" });
    }
  });

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

export const productSchema = z.object({
  // Category ids from GET /api/part-categories (a group id covers the whole group). The server re-validates them.
  categoryIds: z.array(z.string().min(1)).min(1, "Select at least one category you manufacture or supply").max(MAX_PART_CATEGORY_IDS),
  vehicleSegments: z.array(z.enum(VEHICLE_SEGMENT_VALUES)).min(1, "Select at least one vehicle segment"),
  vehicleBrands: z.array(z.string()).min(1, "Select at least one vehicle brand").max(20),
  otherVehicleBrand: z.string().trim().max(100),
  productBrands: text("Product brands", 2, 300),
  skuRange: z.enum(["UNDER_50", "50_200", "200_1000", "1000_5000", "OVER_5000"], { error: "Select an approximate range" }),
  monthlyCapacity: z.string().trim().max(150),
}).superRefine((v, ctx) => {
  if (v.vehicleBrands.includes("Other") && v.otherVehicleBrand.length < 2) {
    ctx.addIssue({ code: "custom", path: ["otherVehicleBrand"], message: "Tell us which other vehicle brand you supply" });
  }
});

export const bankSchema = z.object({
  accountHolder: text("Account holder name", 2, 120),
  bankName: text("Bank name", 2, 100),
  accountNumber: z.string().trim().regex(ACCOUNT_NUMBER_REGEX, "Account number must be 9 to 18 digits"),
  ifsc: z.preprocess(upper, z.string().min(1, "IFSC is required").regex(IFSC_REGEX, "IFSC looks like HDFC0001234")),
  warehouseAddress: text("Warehouse address", 8, 300),
  warehousePincode: z.string().trim().regex(PINCODE_REGEX, "Enter a valid 6-digit pincode"),
  pickupContact: mobile("Pickup contact number"),
});

export const STEP_IDS = ["account", "business", "products", "bank", "documents"] as const;
export type StepId = (typeof STEP_IDS)[number];

export const STEP_LABELS: Record<StepId, string> = {
  account: "Account",
  business: "Business",
  products: "Products",
  bank: "Bank & warehouse",
  documents: "Documents",
};

// ───────────────────────── draft ─────────────────────────

export interface RegistrationDraft {
  fullName: string; mobile: string; email: string; password: string; confirmPassword: string;
  businessName: string; businessType: string; pan: string; gstin: string;
  address: string; state: string; city: string; pincode: string;
  categoryIds: string[]; vehicleSegments: string[]; vehicleBrands: string[]; otherVehicleBrand: string;
  productBrands: string; skuRange: string; monthlyCapacity: string;
  accountHolder: string; bankName: string; accountNumber: string; ifsc: string;
  warehouseAddress: string; warehousePincode: string; pickupContact: string;
  files: Partial<Record<DocKey, File>>;
  agreementAccepted: boolean;
}

export const EMPTY_DRAFT: RegistrationDraft = {
  fullName: "", mobile: "", email: "", password: "", confirmPassword: "",
  businessName: "", businessType: "", pan: "", gstin: "",
  address: "", state: "", city: "", pincode: "",
  categoryIds: [], vehicleSegments: [], vehicleBrands: [], otherVehicleBrand: "",
  productBrands: "", skuRange: "", monthlyCapacity: "",
  accountHolder: "", bankName: "", accountNumber: "", ifsc: "",
  warehouseAddress: "", warehousePincode: "", pickupContact: "",
  files: {},
  agreementAccepted: false,
};

export type FieldErrors = Record<string, string>;

function collect(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}

/** Documents step: files + agreement (zod can't see File objects reliably across envs). */
export function validateDocumentsStep(d: Pick<RegistrationDraft, "files" | "gstin" | "agreementAccepted">): FieldErrors {
  const errors: FieldErrors = {};
  const required: DocKey[] = ["panDocument", "bankProof", ...(d.gstin ? (["gstCertificate"] as DocKey[]) : [])];
  for (const key of required) {
    if (!d.files[key]) errors[key] = `${DOC_RULES[key].label} is required`;
  }
  let total = 0;
  for (const [key, file] of Object.entries(d.files) as [DocKey, File][]) {
    if (!file) continue;
    total += file.size;
    const problem = validateDocument(key, file);
    if (problem && !errors[key]) errors[key] = problem;
  }
  if (total > MAX_TOTAL_UPLOAD_BYTES && !errors.form) {
    errors.form = `Selected files total ${(total / 1024 / 1024).toFixed(1)} MB. Keep the total under ${MAX_TOTAL_UPLOAD_BYTES / 1024 / 1024} MB.`;
  }
  if (!d.agreementAccepted) errors.agreementAccepted = "You must accept the seller agreement to apply";
  return errors;
}

/** Validates one step. Returns {} when valid. */
export function validateStep(step: StepId, d: RegistrationDraft): FieldErrors {
  switch (step) {
    case "account": return runSchema(accountSchema, d);
    case "business": return runSchema(businessSchema, d);
    case "products": return runSchema(productSchema, d);
    case "bank": return runSchema(bankSchema, d);
    case "documents": return validateDocumentsStep(d);
  }
}

function runSchema(schema: z.ZodType, d: RegistrationDraft): FieldErrors {
  const r = schema.safeParse(d);
  return r.success ? {} : collect(r.error);
}

/** First step (in order) that has any error, or null. Used before submit as a final gate. */
export function firstInvalidStep(d: RegistrationDraft): { step: StepId; errors: FieldErrors } | null {
  for (const step of STEP_IDS) {
    const errors = validateStep(step, d);
    if (Object.keys(errors).length) return { step, errors };
  }
  return null;
}

/** Which step owns a server-reported field, so a server-side rejection sends the user to the right screen. */
export function stepForField(field: string): StepId {
  const map: Record<string, StepId> = {
    fullName: "account", mobile: "account", email: "account", password: "account", confirmPassword: "account",
    businessName: "business", businessType: "business", pan: "business", gstin: "business",
    address: "business", state: "business", city: "business", pincode: "business",
    categoryIds: "products", vehicleSegments: "products", vehicleBrands: "products", otherVehicleBrand: "products",
    productBrands: "products", skuRange: "products", monthlyCapacity: "products", catalogue: "products",
    accountHolder: "bank", bankName: "bank", accountNumber: "bank", ifsc: "bank",
    warehouseAddress: "bank", warehousePincode: "bank", pickupContact: "bank",
  };
  return map[field] ?? "documents";
}

// ───────────────────────── request ─────────────────────────

export interface RegistrationPayload {
  fullName: string; mobile: string; email: string; password: string;
  businessName: string; businessType: string; pan: string; gstin: string | null;
  address: string; state: string; city: string; pincode: string;
  categoryIds: string[]; vehicleSegments: string[];
  vehicleBrands: string[]; otherVehicleBrand: string | null;
  productBrands: string[]; skuRange: string; monthlyCapacity: string | null;
  bank: { accountHolder: string; bankName: string; accountNumber: string; ifsc: string };
  warehouse: { address: string; pincode: string; pickupContact: string };
  agreement: { accepted: true; version: string };
}

export function buildPayload(d: RegistrationDraft, agreementVersion: string): RegistrationPayload {
  const orNull = (s: string) => (s.trim() ? s.trim() : null);
  return {
    fullName: d.fullName.trim(),
    mobile: normalizeIndianMobile(d.mobile) ?? d.mobile.trim(),
    email: d.email.trim().toLowerCase(),
    password: d.password,
    businessName: d.businessName.trim(),
    businessType: d.businessType,
    pan: d.pan.trim().toUpperCase(),
    gstin: orNull(d.gstin.toUpperCase()),
    address: d.address.trim(),
    state: d.state,
    city: d.city.trim(),
    pincode: d.pincode.trim(),
    categoryIds: d.categoryIds,
    vehicleSegments: d.vehicleSegments,
    vehicleBrands: d.vehicleBrands,
    otherVehicleBrand: d.vehicleBrands.includes("Other") ? orNull(d.otherVehicleBrand) : null,
    productBrands: d.productBrands.split(",").map((b) => b.trim()).filter(Boolean),
    skuRange: d.skuRange,
    monthlyCapacity: orNull(d.monthlyCapacity),
    bank: {
      accountHolder: d.accountHolder.trim(),
      bankName: d.bankName.trim(),
      accountNumber: d.accountNumber.trim(),
      ifsc: d.ifsc.trim().toUpperCase(),
    },
    warehouse: {
      address: d.warehouseAddress.trim(),
      pincode: d.warehousePincode.trim(),
      pickupContact: normalizeIndianMobile(d.pickupContact) ?? d.pickupContact.trim(),
    },
    agreement: { accepted: true, version: agreementVersion },
  };
}

export function buildFormData(d: RegistrationDraft, agreementVersion: string): FormData {
  const fd = new FormData();
  fd.append("payload", new Blob([JSON.stringify(buildPayload(d, agreementVersion))], { type: "application/json" }));
  for (const [key, file] of Object.entries(d.files) as [DocKey, File | undefined][]) {
    if (file) fd.append(key, file, file.name);
  }
  return fd;
}

// ───────────────────────── submission ─────────────────────────

export interface RegistrationSuccess {
  userId: string;
  vendorId?: string;
  status?: string;
}

export type SubmitResult =
  | { ok: true; data: RegistrationSuccess }
  | { ok: false; kind: "validation"; message: string; fieldErrors: FieldErrors }
  | { ok: false; kind: "conflict" | "rate_limited" | "unavailable" | "network" | "server"; message: string; retryAfterSeconds?: number };

const UNAVAILABLE_STATUSES = new Set([404, 405, 501, 502, 503, 504]);

export async function submitRegistration(
  draft: RegistrationDraft,
  agreementVersion: string,
  fetchImpl: typeof fetch = fetch
): Promise<SubmitResult> {
  try {
    const body = await apiFetch<Partial<RegistrationSuccess> & { userId?: unknown }>(
      "/vendors/register",
      { method: "POST", body: buildFormData(draft, agreementVersion), auth: false },
      fetchImpl
    );
    // A 2xx without a user id is a broken server, not a success we can act on.
    if (!body || typeof body.userId !== "string" || !body.userId) {
      return { ok: false, kind: "server", message: "The server accepted the request but returned an unexpected response. Your application may not have been recorded - please try again or contact support." };
    }
    return { ok: true, data: { userId: body.userId, vendorId: typeof body.vendorId === "string" ? body.vendorId : undefined, status: typeof body.status === "string" ? body.status : undefined } };
  } catch (e) {
    if (e instanceof NetworkError) {
      return { ok: false, kind: "network", message: "We couldn't reach the server. Check your connection and try again. Your application has not been submitted." };
    }
    if (e instanceof ApiError) {
      if (UNAVAILABLE_STATUSES.has(e.status)) {
        return { ok: false, kind: "unavailable", message: "Seller registration is not available right now. Your application has not been submitted - please try again later." };
      }
      if (e.status === 429) {
        return { ok: false, kind: "rate_limited", message: e.message, retryAfterSeconds: e.retryAfterSeconds };
      }
      if (e.status === 409) {
        return { ok: false, kind: "conflict", message: e.message };
      }
      if ((e.status === 400 || e.status === 413 || e.status === 415 || e.status === 422) ) {
        return { ok: false, kind: "validation", message: e.message, fieldErrors: e.fieldErrors ?? {} };
      }
      return { ok: false, kind: "server", message: "Something went wrong on our side. Your application has not been submitted - please try again." };
    }
    throw e;
  }
}

/** Last four digits only - the review screen never prints a full bank account number. */
export function maskAccountNumber(n: string): string {
  const digits = n.replace(/\s/g, "");
  return digits.length <= 4 ? digits : `${"•".repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
}
