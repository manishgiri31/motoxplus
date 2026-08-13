import { getShiprocketToken, invalidateShiprocketToken } from "./auth";
import { ShiprocketAuthError } from "./errors";

const API_URL = process.env.SHIPROCKET_API_URL || "https://apiv2.shiprocket.in/v1/external";
const REQUEST_TIMEOUT_MS = 15000;

async function performRequest(path: string, token: string, options: RequestInit): Promise<Response> {
  try {
    return await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(options.headers as Record<string, string> | undefined),
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    // Never include `options` (may carry order/customer data) or headers
    // (carries the bearer token) in the thrown error — message text only.
    throw new ShiprocketAuthError(
      `Shiprocket request to ${path} failed: ${err instanceof Error ? err.message : "network error"}`
    );
  }
}

async function parseResponse<T>(response: Response, path: string): Promise<T> {
  if (!response.ok) {
    let safeMessage = `HTTP ${response.status}`;
    try {
      const body = await response.json();
      if (typeof body?.message === "string") safeMessage = body.message;
    } catch {
      // Unparsable body — keep the generic HTTP-status message.
    }
    throw new ShiprocketAuthError(`Shiprocket API error on ${path}: ${safeMessage}`, response.status);
  }
  return (await response.json()) as T;
}

/**
 * Authenticated fetch against the Shiprocket API. On a 401 (token expired
 * server-side sooner than assumed, or invalidated by a password rotation),
 * refreshes the token exactly once and retries exactly once — if that retry
 * also fails, throws ShiprocketAuthError rather than looping or swallowing it.
 */
export async function shiprocketFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getShiprocketToken();
  const response = await performRequest(path, token, options);

  if (response.status !== 401) {
    return parseResponse<T>(response, path);
  }

  await invalidateShiprocketToken();
  const freshToken = await getShiprocketToken();
  const retryResponse = await performRequest(path, freshToken, options);

  if (retryResponse.status === 401) {
    throw new ShiprocketAuthError(`Shiprocket request to ${path} failed with 401 after token refresh retry`, 401);
  }
  return parseResponse<T>(retryResponse, path);
}
