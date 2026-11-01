// Post-login redirect hygiene. The login forms used to do
// `window.location.href = searchParams.get("callbackUrl")` with no checks —
// `/login?callbackUrl=https://evil.example` bounced a freshly authenticated
// user to an attacker's page (open redirect, classic phishing hop), and
// `callbackUrl=javascript:...` ran script in our origin. Only same-origin
// absolute *paths* are ever acceptable.

export const ROLE_LANDING: Record<string, string> = {
  DEALER: "/dealer/dashboard",
  VENDOR: "/vendor/dashboard",
  ADMIN: "/admin/dashboard",
  SUPER_ADMIN: "/admin/dashboard",
  STAFF: "/admin/dashboard",
  CUSTOMER: "/account",
};

/** Returns `raw` if it's a safe in-app path, otherwise `fallback`. */
export function safeRedirectPath(raw: string | null | undefined, fallback: string): string {
  if (!raw) return fallback;
  // Backslashes and control characters are normalised away by browsers
  // ("/\evil.com" and "/\t/evil.com" both resolve off-site), so reject outright.
  // eslint-disable-next-line no-control-regex
  if (/[\\\u0000-\u001f\u007f]/.test(raw)) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//")) return fallback;
  // Landing back on an auth page after a successful login is a loop at best.
  if (/^\/(login|register|forgot-password|reset-password)(\/|\?|#|$)/.test(raw)) return fallback;
  return raw;
}

/**
 * For `callbackUrl` values coming from the query string. NextAuth's own
 * middleware redirect writes an *absolute* URL there (`?callbackUrl=https://
 * host/dealer/orders`), so a path-only check would throw away every legitimate
 * deep link. Absolute http(s) URLs are therefore reduced to path + query +
 * hash and the host is discarded — we never navigate to a host taken from the
 * query string, only to a path on our own origin.
 */
export function safeCallbackTarget(raw: string | null | undefined, fallback: string): string {
  if (!raw) return fallback;
  if (/^https?:\/\//i.test(raw)) {
    try {
      const u = new URL(raw);
      return safeRedirectPath(`${u.pathname}${u.search}${u.hash}`, fallback);
    } catch {
      return fallback;
    }
  }
  return safeRedirectPath(raw, fallback);
}

export function landingPathForRole(role: string | null | undefined): string {
  return (role && ROLE_LANDING[role]) || "/";
}
