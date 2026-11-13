/**
 * Vendor onboarding: types and calls for the Java API (backend-java, package com.motoxplus.api.vendor).
 * Every call is same-origin `/api/v1/...` with the session cookie (lib/api/client.ts); the vendor is always
 * resolved server-side from the session, never from anything sent here.
 */
import { apiFetch } from "@/lib/api/client";

export type ApplicationState =
  | "DRAFT"
  | "PENDING_VERIFICATION"
  | "DOCUMENTS_PENDING"
  | "UNDER_REVIEW"
  | "ACTIVE"
  | "REJECTED"
  | "SUSPENDED"
  | "BLOCKED";

export type StepId = "account" | "email" | "mobile" | "business" | "categories" | "bank" | "documents" | "review";

export type DocumentType = "PAN_CARD" | "GST_CERTIFICATE" | "BUSINESS_REGISTRATION" | "CANCELLED_CHEQUE" | "ADDRESS_PROOF";

export interface VendorApplication {
  vendorId: string;
  vendorCode: string;
  state: ApplicationState;
  editable: boolean;
  /**
   * False while an auto-approved vendor (approved at registration, like dealers) has not yet submitted the business
   * profile. The account is ACTIVE and the dashboard opens, but selling stays locked until it is complete.
   */
  profileComplete: boolean;
  account: { fullName: string; email: string; mobile: string; emailVerified: boolean; mobileVerified: boolean };
  business: {
    businessName: string;
    businessType: string;
    pan: string;
    gstin: string | null;
    address: string;
    state: string;
    city: string;
    pincode: string;
  } | null;
  categories: { categoryIds: string[]; vehicleSegments: string[] } | null;
  bank: { accountHolder: string; bankName: string; ifsc: string; accountNumberLast4: string } | null;
  documents: { id: string; documentType: DocumentType; label: string; fileName: string; fileSize: number; uploadedAt: string }[];
  requiredDocuments: DocumentType[];
  missingDocuments: DocumentType[];
  steps: { id: StepId; done: boolean }[];
  submittedAt: string | null;
  agreementVersion: string | null;
  decision: { decision: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED"; reason: string | null; decidedAt: string } | null;
  createdAt: string;
}

/** The editable onboarding steps, in order, each with its own page. */
export const ONBOARDING_STEPS = [
  { id: "business", label: "Business details", href: "/vendor/onboarding/business" },
  { id: "categories", label: "Parts you supply", href: "/vendor/onboarding/categories" },
  { id: "bank", label: "Bank account", href: "/vendor/onboarding/bank" },
  { id: "documents", label: "Documents", href: "/vendor/onboarding/documents" },
  { id: "review", label: "Review and submit", href: "/vendor/onboarding/review" },
] as const satisfies readonly { id: StepId; label: string; href: string }[];

export type OnboardingStepId = (typeof ONBOARDING_STEPS)[number]["id"];

export const DOCUMENT_INFO: Record<DocumentType, { label: string; hint: string }> = {
  PAN_CARD: { label: "PAN card", hint: "The business PAN entered in your business details." },
  GST_CERTIFICATE: { label: "GST certificate", hint: "Required because you entered a GSTIN." },
  BUSINESS_REGISTRATION: { label: "Business registration proof", hint: "Udyam, shop & establishment, incorporation certificate or partnership deed." },
  CANCELLED_CHEQUE: { label: "Cancelled cheque or bank proof", hint: "Must show the account holder name and account number you entered." },
  ADDRESS_PROOF: { label: "Business address proof", hint: "Utility bill, rent agreement or property document for the registered address." },
};

export const DOCUMENT_ORDER: DocumentType[] = ["PAN_CARD", "GST_CERTIFICATE", "BUSINESS_REGISTRATION", "CANCELLED_CHEQUE", "ADDRESS_PROOF"];
export const DOCUMENT_ACCEPT = ".pdf,.jpg,.jpeg,.png";
export const DOCUMENT_MAX_BYTES = 5 * 1024 * 1024;

export function stepDone(app: VendorApplication, id: StepId): boolean {
  return app.steps.find((s) => s.id === id)?.done ?? false;
}

/** The first editable step that still needs work, or "review" when everything is filled in. */
export function nextStep(app: VendorApplication): (typeof ONBOARDING_STEPS)[number] {
  return ONBOARDING_STEPS.find((s) => s.id !== "review" && !stepDone(app, s.id)) ?? ONBOARDING_STEPS[ONBOARDING_STEPS.length - 1];
}

// ───────────────────────── calls ─────────────────────────

const BASE = "/vendors/me/application";

export const getApplication = () => apiFetch<VendorApplication>(BASE);

export const saveBusiness = (body: {
  businessName: string;
  businessType: string;
  pan: string;
  gstin: string;
  address: string;
  state: string;
  city: string;
  pincode: string;
}) => apiFetch<VendorApplication>(`${BASE}/business`, { method: "PUT", json: body });

export const saveCategories = (body: { categoryIds: string[]; vehicleSegments: string[] }) =>
  apiFetch<VendorApplication>(`${BASE}/categories`, { method: "PUT", json: body });

export const saveBank = (body: { accountHolder: string; bankName: string; accountNumber: string; ifsc: string }) =>
  apiFetch<VendorApplication>(`${BASE}/bank`, { method: "PUT", json: body });

export function uploadDocument(documentType: DocumentType, file: File) {
  const fd = new FormData();
  fd.append("documentType", documentType);
  fd.append("file", file, file.name);
  return apiFetch<VendorApplication>(`${BASE}/documents`, { method: "POST", body: fd });
}

export const removeDocument = (documentType: DocumentType) =>
  apiFetch<VendorApplication>(`${BASE}/documents/${documentType}`, { method: "DELETE" });

export const documentUrl = (documentId: string) =>
  apiFetch<{ url: string; expiresIn: number }>(`${BASE}/documents/${encodeURIComponent(documentId)}/url`);

export const submitApplication = (body: {
  acceptTerms: boolean;
  acceptVendorAgreement: boolean;
  declareGenuineProducts: boolean;
  declareAccurateInformation: boolean;
}) => apiFetch<VendorApplication>(`${BASE}/submit`, { method: "POST", json: body });

export const registerVendor = (body: { fullName: string; mobile: string; email: string; password: string }) =>
  apiFetch<{ userId: string; vendorId: string; email: string; status: string }>("/vendors/register", {
    method: "POST",
    json: body,
    auth: false,
  });
