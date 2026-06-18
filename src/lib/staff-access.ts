// Defines which staff departments can access which sections.
// ADMIN and SUPER_ADMIN bypass this — they have full access.

const SECTION_DEPARTMENTS: Record<string, string[]> = {
  crm: ["SALES", "MARKETING"],
  dealers: ["SALES"],
  orders: ["SALES", "PRODUCTION", "ACCOUNTS"],
  products: ["MARKETING", "PRODUCTION"],
  invoices: ["ACCOUNTS"],
  "procurement/grn": ["PRODUCTION"],
};

export function canStaffAccess(department: string | null | undefined, section: string): boolean {
  if (!department) return false;
  return SECTION_DEPARTMENTS[section]?.includes(department) ?? false;
}

export function requireSectionAccess(
  role: string,
  department: string | null | undefined,
  section: string
): boolean {
  if (role === "ADMIN" || role === "SUPER_ADMIN") return true;
  if (role === "STAFF") return canStaffAccess(department, section);
  return false;
}

export const STAFF_NAV: Record<string, { label: string; href: string }[]> = {
  SALES: [
    { label: "Dashboard", href: "/admin/dashboard" },
    { label: "Dealers", href: "/admin/dealers" },
    { label: "Orders", href: "/admin/orders" },
    { label: "Leads", href: "/admin/crm/leads" },
    { label: "Pipeline", href: "/admin/crm/pipeline" },
  ],
  MARKETING: [
    { label: "Dashboard", href: "/admin/dashboard" },
    { label: "Products", href: "/admin/products" },
    { label: "Leads", href: "/admin/crm/leads" },
    { label: "Pipeline", href: "/admin/crm/pipeline" },
  ],
  PRODUCTION: [
    { label: "Dashboard", href: "/admin/dashboard" },
    { label: "Orders", href: "/admin/orders" },
    { label: "Products", href: "/admin/products" },
    { label: "GRN", href: "/admin/procurement/grn" },
  ],
  ACCOUNTS: [
    { label: "Dashboard", href: "/admin/dashboard" },
    { label: "Orders", href: "/admin/orders" },
    { label: "Invoices", href: "/admin/invoices" },
  ],
};
