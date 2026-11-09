/**
 * Vendor pickup warehouse: types and calls for the Java API (backend-java, package com.motoxplus.api.vendor.warehouse).
 * The vendor is resolved from the session server-side; nothing here sends a vendor id, status or warehouse name.
 */
import { apiFetch } from "@/lib/api/client";

export type WarehouseStatus = "PENDING" | "ACTIVE" | "FAILED";

export interface WarehouseDetails {
  address: string;
  pin: string;
  city: string;
  state: string;
  phone: string;
  email: string;
  returnAddress: string;
  returnPin: string;
  returnCity: string;
  returnState: string;
}

export interface WarehouseView {
  warehouse: {
    status: WarehouseStatus;
    delhiveryName: string;
    details: WarehouseDetails;
    gstin: string | null;
    lastError: string | null;
    /** REJECTED / NOT_SENT: nothing exists on Delhivery. UNCERTAIN: it may, so only a retry is allowed. */
    lastErrorCode: "REJECTED" | "NOT_SENT" | "UNCERTAIN" | null;
    attempts: number;
    activatedAt: string | null;
    updatedAt: string | null;
  } | null;
  canSubmit: boolean;
  canRetry: boolean;
  prefill: { address: string | null; pin: string | null; city: string | null; state: string | null; phone: string | null; email: string | null };
  vendorCode: string;
  states: string[];
}

export interface WarehouseInput {
  address: string;
  pin: string;
  city: string;
  state: string;
  phone: string;
  email: string;
  returnSameAsPickup: boolean;
  returnAddress?: string;
  returnPin?: string;
  returnCity?: string;
  returnState?: string;
}

const BASE = "/vendors/me/warehouse";

export const getWarehouse = () => apiFetch<WarehouseView>(BASE);
export const submitWarehouse = (input: WarehouseInput) => apiFetch<WarehouseView>(BASE, { method: "POST", json: input });
export const retryWarehouse = () => apiFetch<WarehouseView>(`${BASE}/retry`, { method: "POST" });

/** Same rule as WarehouseNames.java: VND-<vendorCode>-<pin>, uppercase, A-Z 0-9 and hyphen only. */
export function previewWarehouseName(vendorCode: string, pin: string): string {
  return `VND-${vendorCode}-${pin}`
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
}
