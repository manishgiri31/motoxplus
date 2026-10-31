import { getB2bConfig } from "./config";
import { getB2bToken, invalidateB2bToken } from "./auth";
import { DelhiveryB2bAuthError } from "../errors";

export interface B2bResponse {
  /** Parsed body, or null when it was empty / not JSON. */
  json: unknown;
  text: string;
}

/**
 * One authenticated request to ltl-clients-api (Authorization: Bearer <jwt>).
 * Single attempt, no retries — manifest/pickup are not safe to repeat blindly.
 * `path` is appended to the B2B base URL only; this client cannot reach the
 * B2C host (getB2bConfig refuses it).
 */
export async function b2bRequest(
  path: string,
  init: { method: "GET" | "POST"; headers?: Record<string, string>; body?: string | FormData }
): Promise<B2bResponse> {
  const { baseUrl } = getB2bConfig();
  const token = await getB2bToken();

  const res = await fetch(`${baseUrl}${path}`, {
    method: init.method,
    headers: { Accept: "application/json", ...init.headers, Authorization: `Bearer ${token}` },
    body: init.body,
    signal: AbortSignal.timeout(20_000),
  });

  const text = await res.text();

  if (res.status === 401) {
    // Cached JWT no longer accepted: drop it so the NEXT call logs in again.
    // Not retried here — repeating a manifest/pickup POST blindly is unsafe.
    invalidateB2bToken();
    throw new DelhiveryB2bAuthError(`Delhivery B2B rejected the JWT (HTTP 401) on ${init.method} ${path}: ${text.slice(0, 200)}`);
  }
  if (!res.ok) {
    throw new Error(`Delhivery B2B API error ${res.status} on ${init.method} ${path}: ${text.slice(0, 500)}`);
  }

  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { json, text };
}
