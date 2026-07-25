/**
 * Semantic status → display metadata, shared across every StatusBadge in the app.
 *
 * Deliberately contains NO Tailwind class strings and NO lucide imports: `src/lib/**`
 * is not in tailwind.config.ts's `content` globs, so any class string written here
 * would work in dev and silently vanish from the production CSS. StatusBadge maps
 * `tone` to CSS custom properties via `data-tone` instead (see globals.css).
 *
 * Domain-keyed rather than a single flat map because the same string means different
 * things in different enums: REJECTED appears in five domains, PENDING in four,
 * APPROVED in two — a flat map would silently collide.
 */

export type Tone = "neutral" | "info" | "progress" | "ok" | "warn" | "danger";

export type StatusDomain =
  | "order"
  | "payment"
  | "dealer"
  | "vendor"
  | "purchaseRequest"
  | "purchaseOrder"
  | "shipment"
  | "lead"
  | "leadPriority"
  | "urgency"
  | "upi"
  | "compatibility"
  | "user";

/** Icon is a NAME, not a component — keeps lucide out of src/lib and off the
 *  server/client boundary. StatusBadge (a client component) maps name -> <Icon/>. */
export type StatusIcon =
  | "clock"
  | "check"
  | "checkCheck"
  | "x"
  | "alert"
  | "truck"
  | "package"
  | "send"
  | "pause"
  | "ban"
  | "circle"
  | "dot"
  | "flame"
  | "refresh";

export interface StatusMeta {
  tone: Tone;
  /** "Partially Received" — a display label, never the raw enum value. */
  label: string;
  icon: StatusIcon;
  /** Live/in-flight states render an animated dot in StatusBadge. */
  pulse?: boolean;
  /** Marks an end state for pipeline/timeline components (Phase 3). */
  terminal?: boolean;
}

const FALLBACK: StatusMeta = { tone: "neutral", label: "Unknown", icon: "circle" };

function titleCase(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const MAP: Record<StatusDomain, Record<string, StatusMeta>> = {
  // OrderStatus
  order: {
    PENDING: { tone: "warn", label: "Pending", icon: "clock" },
    CONFIRMED: { tone: "info", label: "Confirmed", icon: "check" },
    PROCESSING: { tone: "progress", label: "Processing", icon: "refresh", pulse: true },
    SHIPPED: { tone: "progress", label: "Shipped", icon: "truck", pulse: true },
    DELIVERED: { tone: "ok", label: "Delivered", icon: "checkCheck", terminal: true },
    CANCELLED: { tone: "danger", label: "Cancelled", icon: "x", terminal: true },
    RETURNED: { tone: "danger", label: "Returned", icon: "refresh", terminal: true },
  },

  // PaymentStatus
  payment: {
    PENDING: { tone: "warn", label: "Pending", icon: "clock" },
    PARTIAL: { tone: "warn", label: "Partial", icon: "circle" },
    PAID: { tone: "ok", label: "Paid", icon: "check", terminal: true },
    REFUNDED: { tone: "neutral", label: "Refunded", icon: "refresh", terminal: true },
    FAILED: { tone: "danger", label: "Failed", icon: "alert", terminal: true },
  },

  // DealerStatus
  dealer: {
    PENDING: { tone: "warn", label: "Pending", icon: "clock" },
    ACTIVE: { tone: "ok", label: "Active", icon: "check" },
    REJECTED: { tone: "danger", label: "Rejected", icon: "x", terminal: true },
    SUSPENDED: { tone: "danger", label: "Suspended", icon: "pause" },
  },

  // VendorStatus
  vendor: {
    PENDING: { tone: "warn", label: "Pending", icon: "clock" },
    APPROVED: { tone: "ok", label: "Approved", icon: "check" },
    REJECTED: { tone: "danger", label: "Rejected", icon: "x", terminal: true },
    SUSPENDED: { tone: "warn", label: "Suspended", icon: "pause" },
    BLACKLISTED: { tone: "danger", label: "Blacklisted", icon: "ban", terminal: true },
  },

  // PurchaseRequestStatus
  purchaseRequest: {
    DRAFT: { tone: "neutral", label: "Draft", icon: "circle" },
    SUBMITTED: { tone: "info", label: "Submitted", icon: "send" },
    APPROVED: { tone: "ok", label: "Approved", icon: "check" },
    REJECTED: { tone: "danger", label: "Rejected", icon: "x", terminal: true },
    CONVERTED: { tone: "progress", label: "Converted", icon: "checkCheck", terminal: true },
  },

  // PurchaseOrderStatus
  purchaseOrder: {
    DRAFT: { tone: "neutral", label: "Draft", icon: "circle" },
    SENT: { tone: "info", label: "Sent", icon: "send" },
    ACCEPTED: { tone: "ok", label: "Accepted", icon: "check" },
    REJECTED: { tone: "danger", label: "Rejected", icon: "x", terminal: true },
    PARTIALLY_RECEIVED: { tone: "warn", label: "Partially Received", icon: "package" },
    FULLY_RECEIVED: { tone: "ok", label: "Fully Received", icon: "checkCheck" },
    CANCELLED: { tone: "danger", label: "Cancelled", icon: "x", terminal: true },
    CLOSED: { tone: "neutral", label: "Closed", icon: "check", terminal: true },
  },

  // ShipmentStatus
  shipment: {
    PENDING: { tone: "warn", label: "Pending", icon: "clock" },
    MANIFESTED: { tone: "info", label: "Manifested", icon: "package" },
    PICKED_UP: { tone: "progress", label: "Picked Up", icon: "truck", pulse: true },
    IN_TRANSIT: { tone: "progress", label: "In Transit", icon: "truck", pulse: true },
    OUT_FOR_DELIVERY: { tone: "progress", label: "Out For Delivery", icon: "truck", pulse: true },
    DELIVERED: { tone: "ok", label: "Delivered", icon: "checkCheck", terminal: true },
    FAILED_DELIVERY: { tone: "danger", label: "Failed Delivery", icon: "alert" },
    RETURNED: { tone: "danger", label: "Returned", icon: "refresh", terminal: true },
    CANCELLED: { tone: "danger", label: "Cancelled", icon: "x", terminal: true },
  },

  // LeadStatus
  lead: {
    NEW: { tone: "info", label: "New", icon: "dot" },
    CONTACTED: { tone: "info", label: "Contacted", icon: "check" },
    INTERESTED: { tone: "progress", label: "Interested", icon: "circle" },
    NEGOTIATION: { tone: "warn", label: "Negotiation", icon: "flame", pulse: true },
    CONVERTED: { tone: "ok", label: "Converted", icon: "checkCheck", terminal: true },
    LOST: { tone: "danger", label: "Lost", icon: "x", terminal: true },
    DORMANT: { tone: "neutral", label: "Dormant", icon: "pause", terminal: true },
  },

  // LeadPriority
  leadPriority: {
    LOW: { tone: "neutral", label: "Low", icon: "dot" },
    MEDIUM: { tone: "warn", label: "Medium", icon: "dot" },
    HIGH: { tone: "danger", label: "High", icon: "dot" },
  },

  // Urgency
  urgency: {
    LOW: { tone: "neutral", label: "Low", icon: "dot" },
    NORMAL: { tone: "info", label: "Normal", icon: "dot" },
    HIGH: { tone: "warn", label: "High", icon: "alert" },
    CRITICAL: { tone: "danger", label: "Critical", icon: "flame", pulse: true },
  },

  // UpiSubmissionStatus
  upi: {
    SUBMITTED: { tone: "info", label: "Submitted", icon: "send" },
    UNDER_REVIEW: { tone: "warn", label: "Under Review", icon: "clock", pulse: true },
    VERIFIED: { tone: "ok", label: "Verified", icon: "check", terminal: true },
    REJECTED: { tone: "danger", label: "Rejected", icon: "x", terminal: true },
  },

  // CompatibilityConfidence
  compatibility: {
    VERIFIED: { tone: "ok", label: "Verified", icon: "checkCheck" },
    LIKELY: { tone: "info", label: "Likely", icon: "check" },
    UNVERIFIED: { tone: "warn", label: "Unverified", icon: "alert" },
    INCOMPATIBLE: { tone: "danger", label: "Incompatible", icon: "ban" },
  },

  // UserRole
  user: {
    GUEST: { tone: "neutral", label: "Guest", icon: "dot" },
    DEALER: { tone: "info", label: "Dealer", icon: "dot" },
    VENDOR: { tone: "progress", label: "Vendor", icon: "dot" },
    ADMIN: { tone: "danger", label: "Admin", icon: "dot" },
    SUPER_ADMIN: { tone: "danger", label: "Super Admin", icon: "dot" },
    STAFF: { tone: "neutral", label: "Staff", icon: "dot" },
    SALES: { tone: "neutral", label: "Sales", icon: "dot" },
    SUPPORT: { tone: "neutral", label: "Support", icon: "dot" },
    PRODUCTION: { tone: "neutral", label: "Production", icon: "dot" },
    DISPATCH: { tone: "neutral", label: "Dispatch", icon: "dot" },
    ACCOUNTS: { tone: "neutral", label: "Accounts", icon: "dot" },
    MARKETING: { tone: "neutral", label: "Marketing", icon: "dot" },
  },
};

/** Canonical display order — drives FilterChips, pipeline columns, sort. */
export const STATUS_ORDER: Record<StatusDomain, readonly string[]> = Object.fromEntries(
  Object.entries(MAP).map(([domain, entries]) => [domain, Object.keys(entries)])
) as Record<StatusDomain, readonly string[]>;

export function statusMeta(domain: StatusDomain, value?: string | null): StatusMeta {
  if (!value) return FALLBACK;
  const known = MAP[domain]?.[value];
  if (known) return known;
  return { ...FALLBACK, label: titleCase(value) };
}

export function toneOf(domain: StatusDomain, value?: string | null): Tone {
  return statusMeta(domain, value).tone;
}

export function statusLabel(domain: StatusDomain, value?: string | null): string {
  return statusMeta(domain, value).label;
}
