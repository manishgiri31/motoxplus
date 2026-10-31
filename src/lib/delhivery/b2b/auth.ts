import { getB2bConfig } from "./config";
import { DelhiveryB2bAuthError, DelhiveryB2bAuthLockedError, DelhiveryNotSpecifiedError } from "../errors";

/** JWT is valid 24h per the B2B docs; refresh an hour early so it never expires mid-request. */
export const B2B_TOKEN_CACHE_MS = 23 * 60 * 60 * 1000;
/** After a rejected login, make NO login attempt for this long (account-lockout protection). */
export const B2B_LOGIN_LOCK_MS = 10 * 60 * 1000;

// Per-process, in memory. A multi-instance deploy logs in once per instance,
// and each instance keeps its own lock window.
let cached: { token: string; expiresAt: number } | null = null;
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

function pickPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    return acc !== null && typeof acc === "object" ? (acc as Record<string, unknown>)[key] : undefined;
  }, obj);
}

/** Top-level key names only — never values, so a token can't leak into an error message. */
function describeKeys(body: unknown): string {
  if (body === null || typeof body !== "object") return `(response was ${body === null ? "null" : typeof body}, not an object)`;
  const keys = Object.keys(body as object);
  return keys.length ? keys.join(", ") : "(empty object)";
}

async function login(now: number): Promise<string> {
  const { baseUrl, username, password, tokenField } = getB2bConfig();

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
    throw new DelhiveryB2bAuthError(`Delhivery B2B login rejected (HTTP ${res.status}): ${detail}`);
  }

  const body: unknown = await res.json().catch(() => undefined);

  if (!tokenField) {
    throw new DelhiveryNotSpecifiedError(
      `DELHIVERY_B2B_TOKEN_FIELD is not set — the JWT field name in the /ums/login response is not specified. ` +
        `Login succeeded; response keys: ${describeKeys(body)}. Set DELHIVERY_B2B_TOKEN_FIELD to the one holding the JWT.`
    );
  }
  const token = pickPath(body, tokenField);
  if (typeof token !== "string" || token.length === 0) {
    throw new DelhiveryNotSpecifiedError(
      `Unexpected Delhivery B2B login response: no non-empty string at "${tokenField}". Response keys: ${describeKeys(body)}.`
    );
  }
  return token;
}

/**
 * The B2B JWT, from cache (23h) or a fresh POST /ums/login. Concurrent callers
 * share one login. Never loops: one attempt per call, and a rejected login
 * blocks further attempts for 10 minutes.
 */
export async function getB2bToken(): Promise<string> {
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.token;
  if (lockedUntil > now) throw new DelhiveryB2bAuthLockedError(lockedUntil - now);
  if (inflight) return inflight;

  inflight = login(now)
    .then((token) => {
      cached = { token, expiresAt: Date.now() + B2B_TOKEN_CACHE_MS };
      return token;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}
