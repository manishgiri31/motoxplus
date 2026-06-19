const BASE_URL = process.env.DELHIVERY_BASE_URL || "https://track.delhivery.com";
const API_TOKEN = process.env.DELHIVERY_API_TOKEN || "";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface FetchOptions extends RequestInit {
  retries?: number;
}

export async function delhiveryFetch<T>(
  path: string,
  options: FetchOptions = {}
): Promise<T> {
  const { retries = MAX_RETRIES, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    Authorization: `Token ${API_TOKEN}`,
    Accept: "application/json",
    ...(fetchOptions.headers as Record<string, string>),
  };

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(`${BASE_URL}${path}`, {
        ...fetchOptions,
        headers,
        signal: AbortSignal.timeout(15000),
      });

      if (response.status === 429) {
        const wait = RETRY_DELAY_MS * Math.pow(2, attempt);
        await sleep(wait);
        continue;
      }

      if (response.status === 401) {
        throw new Error("DELHIVERY_AUTH_ERROR: Invalid or expired API token");
      }

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Delhivery API error ${response.status}: ${text}`);
      }

      return (await response.json()) as T;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (lastError.message.startsWith("DELHIVERY_AUTH_ERROR")) throw lastError;

      if (attempt < retries - 1) {
        await sleep(RETRY_DELAY_MS * Math.pow(2, attempt));
      }
    }
  }

  throw lastError ?? new Error("Delhivery API request failed after retries");
}

export async function delhiveryPost<T>(
  path: string,
  formData: Record<string, string>
): Promise<T> {
  const body = new URLSearchParams(formData).toString();

  return delhiveryFetch<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
}
