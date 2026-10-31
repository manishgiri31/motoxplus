import { getB2bConfig } from "./config";
import { DelhiveryB2bAuthError, DelhiveryB2bAuthLockedError, DelhiveryNotSpecifiedError } from "../errors";

/** Refresh the JWT this long before its own `exp`, so it never expires mid-request. */
export const B2B_TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000;
/**
 * After a rejected login, make NO login attempt for this long. This is what
 * "no retry loop on wrong credentials" means in practice: a bad password is
 * tried once per window instead of once per request.
 */
export const B2B_LOGIN_LOCK_MS = 10 * 60 * 1000;

// Per-process, in memory. A multi-instance deploy logs in once per instance,
// and each instance keeps its own lock window.
let cached: { token: string; refreshAt: number } | null = null;
let lockedUntil = 0;
let inflight: Promise<string> | null = null;

/** Test hook — also usable to force a re-login. */
export function resetB2bAuthState(): void {
  cached = null;
  lockedUntil = 0;
  inflight = null;
}

/** Drop the cached JWT (e.g. the API answered 401). The next call logs in again. */
export function invalidateB2bToken(): void {
  cached = null;
}

/** Top-level (and `data`) key names only — never values, so a token can't leak into an error message. */
function describeKeys(body: unknown): string {
  if (body === null || typeof body !== "object") return `(response was ${body === null ? "null" : typeof body}, not an object)`;
  const top = Object.keys(body as object);
  const data = (body as Record<string, unknown>).data;
  const inner = data !== null && typeof data === "object" ? Object.keys(data as object) : null;
  return `${top.length ? top.join(", ") : "(none)"}${inner ? `; data keys: ${inner.length ? inner.join(", ") : "(none)"}` : ""}`;
}

/**
 * `exp` (Unix seconds) from the JWT payload, in ms. The signature is NOT
 * verified — we only read our own freshly issued token's expiry.
 */
function jwtExpiryMs(jwt: string): number | null {
  const parts = jwt.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as { exp?: unknown };
    return typeof payload.exp === "number" && Number.isFinite(payload.exp) ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

async function login(now: number): Promise<{ token: string; refreshAt: number }> {
  const { baseUrl, username, password } = getB2bConfig();

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/ums/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ username, password }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    // Network failure: not a credentials problem, so no lock — but also no retry here.
    throw new DelhiveryB2bAuthError(`Delhivery B2B login request failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 200);
    // 4xx = the server understood and refused (bad credentials is the case that
    // matters): lock so a wrong password is not hammered. 5xx = their outage,
    // not our credentials: surface the error, no lock.
    if (res.status >= 400 && res.status < 500) lockedUntil = now + B2B_LOGIN_LOCK_MS;
    // The request body (username/password) is never included in this message.
    throw new DelhiveryB2bAuthError(`Delhivery B2B login rejected (HTTP ${res.status}): ${detail}`);
  }

  const body: unknown = await res.json().catch(() => undefined);

  // Verified live: the JWT is a string at data.jwt.
  const data = body !== null && typeof body === "object" ? (body as Record<string, unknown>).data : undefined;
  const token = data !== null && typeof data === "object" ? (data as Record<string, unknown>).jwt : undefined;
  if (typeof token !== "string" || token.length === 0) {
    throw new DelhiveryNotSpecifiedError(
      `Unexpected Delhivery B2B login response: expected a non-empty string at data.jwt. Response keys: ${describeKeys(body)}.`
    );
  }

  const expMs = jwtExpiryMs(token);
  if (expMs === null) {
    throw new DelhiveryNotSpecifiedError(
      "Unexpected Delhivery B2B login response: data.jwt is not a JWT with a numeric `exp` claim, so its expiry is unknown."
    );
  }
  return { token, refreshAt: expMs - B2B_TOKEN_REFRESH_MARGIN_MS };
}

/**
 * The B2B JWT, from cache or a fresh POST /ums/login. The cache lives until 5
 * minutes before the token's own `exp`. Concurrent callers share one login.
 * Never loops: one attempt per call, and a rejected login blocks further
 * attempts for 10 minutes.
 */
export async function getB2bToken(): Promise<string> {
  const now = Date.now();
  if (cached && cached.refreshAt > now) return cached.token;
  if (lockedUntil > now) throw new DelhiveryB2bAuthLockedError(lockedUntil - now);
  if (inflight) return inflight;

  inflight = login(now)
    .then(({ token, refreshAt }) => {
      // A token that is already inside its refresh margin is used for this
      // call but not cached, so it is replaced on the next one.
      cached = refreshAt > Date.now() ? { token, refreshAt } : null;
      return token;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}
