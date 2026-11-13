/**
 * One login, several profiles. A user can hold a dealer, customer and/or vendor profile on the SAME account
 * (same email, mobile, password, verification). `User.role` is the active workspace: every page, API route,
 * token refresh and the Java API already read the role from there, so switching workspace = changing that one
 * column (after checking the profile exists) and re-issuing the session cookies (/api/auth/switch-workspace).
 * Staff and admin accounts never switch.
 */

export type Workspace = "DEALER" | "CUSTOMER" | "VENDOR";

export const WORKSPACES: readonly Workspace[] = ["DEALER", "CUSTOMER", "VENDOR"];

export const WORKSPACE_INFO: Record<Workspace, { label: string; purpose: string; home: string }> = {
  DEALER: { label: "Dealer", purpose: "Buy at dealer prices", home: "/dealer/dashboard" },
  CUSTOMER: { label: "Customer", purpose: "Buy for yourself", home: "/account" },
  VENDOR: { label: "Vendor", purpose: "Sell your parts", home: "/vendor/dashboard" },
};

export function isWorkspace(v: unknown): v is Workspace {
  return typeof v === "string" && (WORKSPACES as readonly string[]).includes(v);
}

interface ProfileHolder {
  role: string;
  dealer?: { id: string } | null;
  customer?: { id: string } | null;
  vendor?: { id: string } | null;
}

/** The workspaces this account can switch between, in a stable order. Empty for staff/admin accounts. */
export function availableWorkspaces(user: ProfileHolder): Workspace[] {
  if (!isWorkspace(user.role)) return [];
  const out: Workspace[] = [];
  if (user.dealer) out.push("DEALER");
  if (user.customer) out.push("CUSTOMER");
  if (user.vendor) out.push("VENDOR");
  return out;
}

/** Why `target` can't be switched to, or null when it can. */
export function switchError(user: ProfileHolder, target: unknown): string | null {
  if (!isWorkspace(target)) return "Unknown workspace";
  if (!isWorkspace(user.role)) return "Staff accounts can't switch workspace";
  if (!availableWorkspaces(user).includes(target)) return `This account has no ${WORKSPACE_INFO[target].label.toLowerCase()} profile yet`;
  return null;
}
