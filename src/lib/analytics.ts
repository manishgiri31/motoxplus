/**
 * Tiny, vendor-neutral analytics hook. The site has no analytics SDK yet, so events are:
 *   1. pushed to `window.dataLayer` (Google Tag Manager picks them up if/when a container is added), and
 *   2. dispatched as a `mx:analytics` DOM event, so any future collector can subscribe without touching callers.
 *
 * Event payloads are typed so PII can't slip in by accident: search events carry the query's
 * *length*, never its text.
 */

export type SearchSource = "overlay" | "results_page";

export interface AnalyticsEvents {
  search_open: { trigger: "button" | "shortcut" };
  search_query: { query_length: number; result_count: number; source: SearchSource };
  search_no_results: { query_length: number; source: SearchSource };
  search_result_click: {
    /** 1-based position among the selectable results, top to bottom. */
    position: number;
    group: string;
    source: SearchSource | "recent" | "popular";
  };
}

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

export function track<E extends keyof AnalyticsEvents>(event: E, props: AnalyticsEvents[E]): void {
  if (typeof window === "undefined") return;
  try {
    const payload = { event, ...props };
    window.dataLayer?.push(payload);
    window.dispatchEvent(new CustomEvent("mx:analytics", { detail: payload }));
    // eslint-disable-next-line no-console -- dev-only visibility until a real collector is wired
    if (process.env.NODE_ENV === "development") console.debug("[analytics]", payload);
  } catch {
    /* analytics must never break the UI */
  }
}
