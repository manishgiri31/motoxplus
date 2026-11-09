/**
 * Vendor listings (marketplace Phase 4): types, form rules and calls for the Java API
 * (backend-java, package com.motoxplus.api.vendor.listings).
 *
 * The rules and messages below mirror ListingRules.java so the editor can show problems as the vendor types. The Java
 * API is the authority: it re-checks everything, and its fieldErrors are shown exactly like these.
 *
 * Nothing here ever sends a vendorId, status or productId: the API resolves the vendor from the session, and status
 * changes only through publish / unpublish.
 */
import { apiFetch } from "@/lib/api/client";

// ───────────────────────── types ─────────────────────────

export type ListingStatus = "DRAFT" | "LIVE" | "UNPUBLISHED";

export interface ListingImage {
  id: string;
  /** Same-origin URL served by the Java API from the private bucket (owner only). */
  url: string;
  fileName: string;
  size: number;
  mimeType: string;
  primary: boolean;
}

export interface ListingFitment {
  vehicleId: string;
  vehicleName: string;
  manufacturer: string;
  yearFrom: number | null;
  yearTo: number | null;
}

export interface Readiness {
  ready: boolean;
  problems: Record<string, string>;
}

interface ListingBase {
  id: string;
  status: ListingStatus;
  title: string;
  brand: string | null;
  categoryName: string | null;
  partNumber: string | null;
  sku: string | null;
  /** Rupees. */
  mrp: number | null;
  retailPrice: number | null;
  dealerPrice: number | null;
  stock: number | null;
  readiness: Readiness;
  storefront: { visible: boolean; url: string | null };
  updatedAt: string;
}

export interface ListingSummary extends ListingBase {
  imageCount: number;
  thumbnailUrl: string | null;
}

export interface Listing extends ListingBase {
  description: string | null;
  categoryId: string | null;
  hsnCode: string | null;
  gstRate: number;
  moq: number;
  warranty: string | null;
  countryOfOrigin: string;
  weightGrams: number | null;
  images: ListingImage[];
  fitment: ListingFitment[];
  firstPublishedAt: string | null;
  publishedAt: string | null;
  unpublishedAt: string | null;
  createdAt: string;
}

export interface CategoryGroup {
  id: string;
  name: string;
  children: { id: string; name: string }[];
}

export interface ListingsOverview {
  counts: Record<ListingStatus | "ALL", number>;
  categories: CategoryGroup[];
  commission: { saleCommissionBp: number };
  gstRates: number[];
  limits: { maxImages: number; maxImageBytes: number; maxFitment: number };
}

export interface VehicleOption {
  id: string;
  name: string;
  manufacturer: string;
  category: string;
  yearFrom: number | null;
  yearTo: number | null;
}

export interface Page<T> {
  items: T[];
  page: number;
  size: number;
  total: number;
  totalPages: number;
}

/** Exactly what the API accepts. Prices in rupees. */
export interface ListingInput {
  title: string;
  description: string | null;
  brand: string | null;
  categoryId: string | null;
  partNumber: string | null;
  sku: string | null;
  hsnCode: string | null;
  gstRate: number | null;
  moq: number | null;
  stock: number | null;
  warranty: string | null;
  countryOfOrigin: string | null;
  weightGrams: number | null;
  mrp: number | null;
  retailPrice: number | null;
  dealerPrice: number | null;
  fitment: { vehicleId: string; yearFrom: number | null; yearTo: number | null }[];
}

// ───────────────────────── form values ─────────────────────────

export interface FitmentValue {
  vehicleId: string;
  vehicleName: string;
  manufacturer: string;
  yearFrom: string;
  yearTo: string;
}

/** The editor's state: text exactly as typed. */
export interface ListingFormValues {
  title: string;
  description: string;
  brand: string;
  categoryId: string;
  partNumber: string;
  sku: string;
  hsnCode: string;
  gstRate: string;
  moq: string;
  stock: string;
  warranty: string;
  countryOfOrigin: string;
  weightGrams: string;
  mrp: string;
  retailPrice: string;
  dealerPrice: string;
  fitment: FitmentValue[];
}

export type FieldKey =
  | "title"
  | "categoryId"
  | "brand"
  | "partNumber"
  | "sku"
  | "description"
  | "images"
  | "mrp"
  | "retailPrice"
  | "dealerPrice"
  | "stock"
  | "moq"
  | "fitment"
  | "hsnCode"
  | "gstRate"
  | "weightGrams"
  | "warranty"
  | "countryOfOrigin";

export type FieldErrors = Partial<Record<FieldKey, string>>;

/** The editor's sections, top to bottom (same order as ListingRules.FIELD_ORDER). */
export const FIELD_ORDER: FieldKey[] = [
  "title",
  "categoryId",
  "brand",
  "partNumber",
  "sku",
  "description",
  "images",
  "mrp",
  "retailPrice",
  "dealerPrice",
  "stock",
  "moq",
  "fitment",
  "hsnCode",
  "gstRate",
  "weightGrams",
  "warranty",
  "countryOfOrigin",
];

export const MAX_IMAGES = 8;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const IMAGE_ACCEPT = ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp";
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const GST_RATES = [0, 5, 18, 40];
export const MAX_PRICE = 1_000_000;

export function emptyForm(): ListingFormValues {
  return {
    title: "",
    description: "",
    brand: "",
    categoryId: "",
    partNumber: "",
    sku: "",
    hsnCode: "",
    gstRate: "18",
    moq: "1",
    stock: "",
    warranty: "",
    countryOfOrigin: "India",
    weightGrams: "",
    mrp: "",
    retailPrice: "",
    dealerPrice: "",
    fitment: [],
  };
}

const str = (v: string | number | null | undefined) => (v == null ? "" : String(v));

export function formFromListing(l: Listing): ListingFormValues {
  return {
    title: l.title,
    description: str(l.description),
    brand: str(l.brand),
    categoryId: str(l.categoryId),
    partNumber: str(l.partNumber),
    sku: str(l.sku),
    hsnCode: str(l.hsnCode),
    gstRate: str(l.gstRate),
    moq: str(l.moq),
    stock: str(l.stock),
    warranty: str(l.warranty),
    countryOfOrigin: l.countryOfOrigin || "India",
    weightGrams: str(l.weightGrams),
    mrp: str(l.mrp),
    retailPrice: str(l.retailPrice),
    dealerPrice: str(l.dealerPrice),
    fitment: l.fitment.map((f) => ({
      vehicleId: f.vehicleId,
      vehicleName: f.vehicleName,
      manufacturer: f.manufacturer,
      yearFrom: str(f.yearFrom),
      yearTo: str(f.yearTo),
    })),
  };
}

// ───────────────────────── parsing ─────────────────────────

/** Single-line field: trimmed, internal whitespace collapsed (same as ListingRules.line). */
export function line(s: string): string {
  return s.trim().replace(/\s+/g, " ");
}

/** "1,299" / " 1299 " / "1299.00" -> 1299. Empty -> null. Anything that isn't a number -> NaN. */
export function parseAmount(s: string): number | null {
  const t = s.replace(/[,\s₹]/g, "");
  if (t === "") return null;
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : NaN;
}

/** Whole numbers only; empty -> null; anything else -> NaN. */
export function parseCount(s: string): number | null {
  const t = s.replace(/[,\s]/g, "");
  if (t === "") return null;
  return /^-?\d+$/.test(t) ? Number(t) : NaN;
}

const nullIfEmpty = (s: string) => {
  const t = line(s);
  return t === "" ? null : t;
};

/** Form values -> the API payload. Call only when validateFormat() is clean, so numbers are numbers. */
export function toInput(v: ListingFormValues): ListingInput {
  const num = (x: number | null) => (x == null || Number.isNaN(x) ? null : x);
  return {
    title: line(v.title),
    description: v.description.trim() === "" ? null : v.description.trim(),
    brand: nullIfEmpty(v.brand),
    categoryId: nullIfEmpty(v.categoryId),
    partNumber: nullIfEmpty(v.partNumber),
    sku: nullIfEmpty(v.sku),
    hsnCode: nullIfEmpty(v.hsnCode.replace(/\s/g, "")),
    gstRate: num(parseAmount(v.gstRate)),
    moq: num(parseCount(v.moq)),
    stock: num(parseCount(v.stock)),
    warranty: nullIfEmpty(v.warranty),
    countryOfOrigin: nullIfEmpty(v.countryOfOrigin),
    weightGrams: num(parseCount(v.weightGrams)),
    mrp: num(parseAmount(v.mrp)),
    retailPrice: num(parseAmount(v.retailPrice)),
    dealerPrice: num(parseAmount(v.dealerPrice)),
    fitment: v.fitment.map((f) => ({
      vehicleId: f.vehicleId,
      yearFrom: num(parseCount(f.yearFrom)),
      yearTo: num(parseCount(f.yearTo)),
    })),
  };
}

// ───────────────────────── rules (mirror ListingRules.java) ─────────────────────────

const PART_NUMBER = /^[A-Za-z0-9][A-Za-z0-9 ./_-]*$/;
const SKU = /^[A-Za-z0-9][A-Za-z0-9./_-]*$/;
const HSN = /^(\d{4}|\d{6}|\d{8})$/;

/** One price: null when empty, else the error (if any). */
export function priceError(raw: string, label: string): string | undefined {
  const n = parseAmount(raw);
  if (n == null) return undefined;
  if (Number.isNaN(n)) return `Enter ${label === "MRP" ? "the MRP" : `the ${label.toLowerCase()}`} as a number`;
  if (n <= 0) return `${label} must be more than ₹0`;
  if (!Number.isInteger(n)) return `${label} must be a whole rupee amount`;
  if (n > MAX_PRICE) return `${label} can't be more than ₹10,00,000`;
  return undefined;
}

/** MRP >= retail >= dealer; the message goes on the lower price, which is the one out of place. */
export function priceOrderErrors(mrp: number | null, retail: number | null, dealer: number | null): FieldErrors {
  const e: FieldErrors = {};
  if (mrp != null && retail != null && retail > mrp) e.retailPrice = "Retail price can't be higher than the MRP";
  if (retail != null && dealer != null && dealer > retail) e.dealerPrice = "Dealer price can't be higher than the retail price";
  else if (retail == null && mrp != null && dealer != null && dealer > mrp) e.dealerPrice = "Dealer price can't be higher than the MRP";
  return e;
}

/** Format rules: run on every save. A draft may be incomplete but never wrong. */
export function validateFormat(v: ListingFormValues): FieldErrors {
  const e: FieldErrors = {};
  const title = line(v.title);
  if (title === "") e.title = "Add a product title";
  else if (title.length < 3) e.title = "Title must be at least 3 characters";
  else if (title.length > 150) e.title = "Title must be at most 150 characters";

  if (line(v.brand).length > 80) e.brand = "Brand must be at most 80 characters";

  const pn = line(v.partNumber);
  if (pn !== "") {
    if (pn.length < 2 || pn.length > 60) e.partNumber = "Part number must be 2 to 60 characters";
    else if (!PART_NUMBER.test(pn)) e.partNumber = "Use letters, numbers, spaces and . / - _ only";
  }

  const sku = line(v.sku);
  if (sku !== "") {
    if (sku.length > 60) e.sku = "SKU must be at most 60 characters";
    else if (!SKU.test(sku)) e.sku = "Use letters, numbers and . / - _ only (no spaces)";
  }

  if (v.description.trim().length > 5000) e.description = "Description must be at most 5,000 characters";

  const priceErrors: [FieldKey, string, string][] = [
    ["mrp", v.mrp, "MRP"],
    ["retailPrice", v.retailPrice, "Retail price"],
    ["dealerPrice", v.dealerPrice, "Dealer price"],
  ];
  for (const [k, raw, label] of priceErrors) {
    const err = priceError(raw, label);
    if (err) e[k] = err;
  }
  const ok = (k: FieldKey, raw: string) => (e[k] ? null : parseAmount(raw));
  const order = priceOrderErrors(ok("mrp", v.mrp), ok("retailPrice", v.retailPrice), ok("dealerPrice", v.dealerPrice));
  if (order.retailPrice && !e.retailPrice) e.retailPrice = order.retailPrice;
  if (order.dealerPrice && !e.dealerPrice) e.dealerPrice = order.dealerPrice;

  const stock = parseCount(v.stock);
  if (stock != null && (Number.isNaN(stock) || stock < 0 || stock > 1_000_000)) e.stock = "Stock must be between 0 and 10,00,000";

  const moq = parseCount(v.moq);
  if (moq != null && (Number.isNaN(moq) || moq < 1 || moq > 10_000)) e.moq = "Minimum order quantity must be between 1 and 10,000";

  if (v.fitment.length > 50) e.fitment = "List at most 50 vehicles";
  for (const f of v.fitment) {
    const from = parseCount(f.yearFrom);
    const to = parseCount(f.yearTo);
    const bad = (y: number | null) => y != null && (Number.isNaN(y) || y < 1950 || y > 2100);
    if (bad(from) || bad(to)) {
      e.fitment = "Years must be between 1950 and 2100";
      break;
    }
    if (from != null && to != null && from > to) {
      e.fitment = "A vehicle's 'from' year must not be after its 'to' year";
      break;
    }
  }

  const hsn = v.hsnCode.replace(/\s/g, "");
  if (hsn !== "" && !HSN.test(hsn)) e.hsnCode = "HSN code is 4, 6 or 8 digits";

  const gst = parseAmount(v.gstRate);
  if (gst != null && !GST_RATES.includes(gst)) e.gstRate = "Choose a GST rate: 0%, 5%, 18% or 40%";

  const weight = parseCount(v.weightGrams);
  if (weight != null && (Number.isNaN(weight) || weight < 1 || weight > 100_000)) e.weightGrams = "Packed weight must be between 1 g and 100 kg";

  if (line(v.warranty).length > 80) e.warranty = "Warranty must be at most 80 characters";
  const origin = line(v.countryOfOrigin);
  if (origin !== "" && (origin.length < 2 || origin.length > 60)) e.countryOfOrigin = "Country of origin must be 2 to 60 characters";
  return e;
}

/** Completeness rules: what stops a listing from going live (and what a live listing must keep). */
export function publishProblems(v: ListingFormValues, imageCount: number): FieldErrors {
  const p: FieldErrors = {};
  if (line(v.title).length < 3) p.title = "Add a product title";
  if (!v.categoryId) p.categoryId = "Choose a category";
  if (line(v.brand) === "") p.brand = "Add the brand";
  if (line(v.partNumber) === "") p.partNumber = "Add the part number";
  if (line(v.sku) === "") p.sku = "Add your SKU";
  if (imageCount < 1) p.images = "Add at least one photo";
  if (parseAmount(v.mrp) == null) p.mrp = "Enter the MRP";
  if (parseAmount(v.retailPrice) == null) p.retailPrice = "Enter the retail price";
  if (parseAmount(v.dealerPrice) == null) p.dealerPrice = "Enter the dealer price";
  const stock = parseCount(v.stock);
  const moq = parseCount(v.moq) ?? 1;
  if (stock == null || Number.isNaN(stock) || stock < 1) p.stock = "Add at least 1 unit of stock";
  else if (!Number.isNaN(moq) && stock < moq) p.stock = `Stock must cover your minimum order quantity (${moq})`;
  if (v.hsnCode.replace(/\s/g, "") === "") p.hsnCode = "Add the HSN code";
  return p;
}

/** Re-orders errors into the editor's order, so "first error" is the first field on screen. */
export function orderedErrors(e: Record<string, string | undefined>): FieldErrors {
  const out: FieldErrors = {};
  for (const k of FIELD_ORDER) if (e[k]) out[k] = e[k];
  return out;
}

// ───────────────────────── money ─────────────────────────

/**
 * What the vendor keeps from one sale at `priceRupees`, given the commission in basis points (1500 = 15%). Paise
 * integer maths, rounded half-up like Money.percentBp in Java, so the estimate matches what settlement will compute.
 * This is an estimate shown while pricing: GST, shipping and returns are not part of it.
 */
export function payoutEstimate(priceRupees: number, commissionBp: number): { commission: number; payout: number } {
  const paise = Math.round(priceRupees * 100);
  const commissionPaise = Math.floor((paise * commissionBp + 5000) / 10_000);
  return { commission: commissionPaise / 100, payout: (paise - commissionPaise) / 100 };
}

/** "₹1,299" or "₹381.65" (Indian digit grouping). */
export function rupees(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function percent(bp: number): string {
  return `${Number((bp / 100).toFixed(2))}%`;
}

// ───────────────────────── calls ─────────────────────────

const BASE = "/vendors/me/listings";
const enc = encodeURIComponent;

export const getListingsOverview = () => apiFetch<ListingsOverview>(`${BASE}/overview`);

export function listListings(p: { status?: ListingStatus; q?: string; page?: number; size?: number } = {}) {
  const qs = new URLSearchParams();
  if (p.status) qs.set("status", p.status);
  if (p.q && p.q.trim()) qs.set("q", p.q.trim());
  if (p.page) qs.set("page", String(p.page));
  if (p.size) qs.set("size", String(p.size));
  const s = qs.toString();
  return apiFetch<Page<ListingSummary>>(s ? `${BASE}?${s}` : BASE);
}

export const getListing = (id: string) => apiFetch<Listing>(`${BASE}/${enc(id)}`);

export const createListing = (input: ListingInput) => apiFetch<Listing>(BASE, { method: "POST", json: input });

export const updateListing = (id: string, input: ListingInput) => apiFetch<Listing>(`${BASE}/${enc(id)}`, { method: "PUT", json: input });

export const publishListing = (id: string) => apiFetch<Listing>(`${BASE}/${enc(id)}/publish`, { method: "POST" });

export const unpublishListing = (id: string) => apiFetch<Listing>(`${BASE}/${enc(id)}/unpublish`, { method: "POST" });

export function uploadListingImage(id: string, file: File) {
  const fd = new FormData();
  fd.append("file", file, file.name);
  return apiFetch<Listing>(`${BASE}/${enc(id)}/images`, { method: "POST", body: fd });
}

export const removeListingImage = (id: string, imageId: string) =>
  apiFetch<Listing>(`${BASE}/${enc(id)}/images/${enc(imageId)}`, { method: "DELETE" });

export const makePrimaryImage = (id: string, imageId: string) =>
  apiFetch<Listing>(`${BASE}/${enc(id)}/images/${enc(imageId)}/primary`, { method: "POST" });

export const searchVehicles = (q: string, signal?: AbortSignal) =>
  apiFetch<VehicleOption[]>(`${BASE}/vehicles?q=${enc(q)}`, { signal });

/** Client-side pre-check of a photo before upload (the server checks the real bytes). */
export function photoProblem(file: File): string | undefined {
  if (file.size === 0) return "This file is empty";
  if (file.size > MAX_IMAGE_BYTES) return "Photo is too large (max 5 MB)";
  if (file.type && !IMAGE_TYPES.includes(file.type)) return "Use a JPG, PNG or WEBP photo";
  return undefined;
}
