/**
 * Browser client for the Java marketplace API (/api/v1).
 *
 * Auth: nothing to manage here. Browser login already sets httpOnly `mx_access` / `mx_refresh` cookies
 * (lib/auth/web-session.ts) and the Java API reads `mx_access`, so same-origin requests with
 * `credentials: "include"` are authenticated without any token in JavaScript. The base URL is relative
 * on purpose: CSP is `connect-src 'self'` and the Java API has CORS disabled.
 *
 * The 15-minute access cookie expires mid-session, so an authenticated call that gets 401 triggers ONE
 * shared refresh (POST /api/auth/refresh) and is retried once. If the refresh fails the 401 is surfaced.
 */

export const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "/api/v1").replace(/\/$/, "");
const REFRESH_PATH = "/api/auth/refresh";

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly fieldErrors?: Record<string, string>;
  readonly retryAfterSeconds?: number;

  constructor(
    status: number,
    message: string,
    extra: { code?: string; fieldErrors?: Record<string, string>; retryAfterSeconds?: number } = {}
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = extra.code;
    this.fieldErrors = extra.fieldErrors;
    this.retryAfterSeconds = extra.retryAfterSeconds;
  }
}

/** The request never produced an HTTP response (offline, DNS, proxy down, aborted by the browser). */
export class NetworkError extends Error {
  constructor(message = "Network request failed") {
    super(message);
    this.name = "NetworkError";
  }
}

export interface ApiRequest extends Omit<RequestInit, "body"> {
  /** JSON body; serialised for you. Mutually exclusive with `body`. */
  json?: unknown;
  /** FormData / string body (Content-Type is left to the browser for FormData). */
  body?: BodyInit | null;
  /** Skip the 401 -> refresh -> retry dance (public endpoints such as registration). Default true. */
  auth?: boolean;
}

let refreshInFlight: Promise<boolean> | null = null;

/** Single-flight: concurrent 401s share one refresh call. */
function refreshSession(fetchImpl: typeof fetch): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = fetchImpl(REFRESH_PATH, { method: "POST", credentials: "include" })
      .then((r) => r.ok)
      .catch(() => false)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

async function toApiError(res: Response): Promise<ApiError> {
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* non-JSON error body (proxy 502 page, empty 404) */
  }
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const fieldErrors =
    b.fieldErrors && typeof b.fieldErrors === "object" ? (b.fieldErrors as Record<string, string>) : undefined;
  const retry = res.headers.get("Retry-After");
  return new ApiError(res.status, typeof b.error === "string" ? b.error : `Request failed (${res.status})`, {
    code: typeof b.code === "string" ? b.code : undefined,
    fieldErrors,
    retryAfterSeconds:
      typeof b.retryAfterSeconds === "number" ? b.retryAfterSeconds : retry && /^\d+$/.test(retry) ? Number(retry) : undefined,
  });
}

/**
 * Calls `${API_BASE}${path}` and returns the parsed JSON (undefined for 204).
 * Throws ApiError for any non-2xx and NetworkError when no response arrived.
 * `fetchImpl` exists for tests.
 */
export async function apiFetch<T>(path: string, req: ApiRequest = {}, fetchImpl: typeof fetch = fetch): Promise<T> {
  const { json, auth = true, headers, body, ...rest } = req;
  const url = `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;

  const build = (): RequestInit => {
    const h = new Headers(headers);
    h.set("Accept", "application/json");
    let payload: BodyInit | null | undefined = body;
    if (json !== undefined) {
      h.set("Content-Type", "application/json");
      payload = JSON.stringify(json);
    }
    return { ...rest, headers: h, body: payload, credentials: "include" };
  };

  const send = async (): Promise<Response> => {
    try {
      return await fetchImpl(url, build());
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") throw e; // caller-cancelled: not a failure
      throw new NetworkError();
    }
  };

  let res = await send();
  if (res.status === 401 && auth && (await refreshSession(fetchImpl))) {
    res = await send();
  }

  if (!res.ok) throw await toApiError(res);
  if (res.status === 204) return undefined as T;
  try {
    return (await res.json()) as T;
  } catch {
    throw new ApiError(res.status, "The server returned an unreadable response", { code: "BAD_RESPONSE" });
  }
}
