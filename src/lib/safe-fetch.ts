/**
 * fetch() for form handlers: a dropped connection resolves to a 503 Response
 * whose JSON body carries a readable `error`, instead of throwing. Handlers
 * written as `if (!res.ok) showError(data.error)` then cover the offline case
 * too, rather than leaving a button stuck in its loading state.
 * Pair with `res.json().catch(() => ({}))` for non-JSON error pages.
 */
export async function safeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch {
    return new Response(JSON.stringify({ error: "Network error. Check your connection and try again." }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}
