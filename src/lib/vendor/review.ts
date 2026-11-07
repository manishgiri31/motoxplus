/** Admin review of vendor applications (Java: com.motoxplus.api.vendor.review). */
import { apiFetch } from "@/lib/api/client";
import type { ApplicationState, VendorApplication } from "./onboarding";

export interface ApplicationRow {
  vendorId: string;
  vendorCode: string;
  businessName: string;
  ownerName: string;
  email: string;
  mobile: string;
  state: ApplicationState;
  city: string | null;
  businessState: string | null;
  submittedAt: string | null;
  createdAt: string;
}

export interface Page<T> {
  items: T[];
  page: number;
  size: number;
  total: number;
  totalPages: number;
}

export interface ReviewCheck {
  code: string;
  result: "PASS" | "WARN" | "FAIL";
  message: string;
}

export interface ApplicationDetail extends VendorApplication {
  vendorStatus: string;
  userActive: boolean;
  categoryNames: { id: string; name: string; group: string | null; active: boolean }[];
  agreements: { agreement: string; version: string; acceptedAt: string; ip: string }[];
  checks: ReviewCheck[];
  history: { at: string; action: string; actorRole: string | null; actorName: string | null; reason: string | null; documentType: string | null }[];
}

export type ReviewAction = "approve" | "reject" | "request-changes" | "suspend" | "reactivate" | "block";

export const STATE_LABELS: Record<ApplicationState, string> = {
  UNDER_REVIEW: "Under review",
  DRAFT: "Draft",
  DOCUMENTS_PENDING: "Documents pending",
  PENDING_VERIFICATION: "Verifying contact",
  ACTIVE: "Active",
  REJECTED: "Rejected",
  SUSPENDED: "Suspended",
  BLOCKED: "Blocked",
};

/** Plain-language labels for audit actions shown in the verification history. */
export const HISTORY_LABELS: Record<string, string> = {
  "vendor.registered": "Account created",
  "vendor.application.business_saved": "Business details saved",
  "vendor.application.categories_saved": "Parts categories saved",
  "vendor.application.bank_saved": "Bank account saved",
  "vendor.document.uploaded": "Document uploaded",
  "vendor.document.removed": "Document removed",
  "vendor.application.submitted": "Application submitted",
  "vendor.document.viewed": "Document opened by reviewer",
  "vendor.bank.revealed": "Full account number viewed",
  "vendor.application.approved": "Approved",
  "vendor.application.rejected": "Rejected",
  "vendor.application.changes_requested": "Changes requested",
  "vendor.suspended": "Suspended",
  "vendor.reactivated": "Reactivated",
  "vendor.blocked": "Blocked",
};

const BASE = "/admin/vendor-applications";

export function listApplications(params: { state?: string; q?: string; page?: number }) {
  const sp = new URLSearchParams();
  if (params.state) sp.set("state", params.state);
  if (params.q) sp.set("q", params.q);
  if (params.page) sp.set("page", String(params.page));
  sp.set("size", "25");
  return apiFetch<Page<ApplicationRow>>(`${BASE}?${sp.toString()}`);
}

export const getApplicationDetail = (vendorId: string) => apiFetch<ApplicationDetail>(`${BASE}/${encodeURIComponent(vendorId)}`);

export const reviewDocumentUrl = (vendorId: string, documentId: string) =>
  apiFetch<{ url: string; expiresIn: number }>(`${BASE}/${encodeURIComponent(vendorId)}/documents/${encodeURIComponent(documentId)}/url`);

export const revealAccountNumber = (vendorId: string) =>
  apiFetch<{ accountNumber: string }>(`${BASE}/${encodeURIComponent(vendorId)}/bank-account`);

export const decide = (vendorId: string, action: ReviewAction, reason?: string) =>
  apiFetch<ApplicationDetail>(`${BASE}/${encodeURIComponent(vendorId)}/${action}`, { method: "POST", json: { reason: reason ?? "" } });
