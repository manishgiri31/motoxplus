/**
 * Client for GET /api/search (served by the Java API, backend-java SearchController) plus the bits of
 * search state that live in the browser: the in-memory response cache and recent searches.
 */

export type SearchIcon = "product" | "category" | "vehicle" | "support" | "page";

export interface SearchItem {
  title: string;
  url: string;
  snippet: string;
  icon: SearchIcon;
  image?: string;
}

export interface SearchGroup {
  type: string;
  title: string;
  items: SearchItem[];
}

export interface SearchResponse {
  query: string;
  groups: SearchGroup[];
  hasMore: boolean;
}

export interface SearchParams {
  q: string;
  limit?: number;
  type?: "all" | "products";
  category?: string;
  sort?: "relevance" | "name" | "newest";
  offset?: number;
}

export const MIN_QUERY_LENGTH = 2;
export const MAX_QUERY_LENGTH = 100;

/** Thrown when the request never got an answer (offline, server down) — as opposed to being aborted. */
export class SearchUnavailableError extends Error {
  constructor() {
    super("Search is unavailable");
    this.name = "SearchUnavailableError";
  }
}

/* ---------------------------------------------------------------------------------------------
 * Session cache: responses are reused for the life of the tab (module scope survives client-side
 * navigation). Bounded so a long session of typing can't grow it without limit.
 * ------------------------------------------------------------------------------------------- */
const CACHE_LIMIT = 60;
const cache = new Map<string, SearchResponse>();

function cacheKey(p: SearchParams): string {
  return [p.q.trim().toLowerCase(), p.limit ?? 8, p.type ?? "all", p.category ?? "", p.sort ?? "relevance", p.offset ?? 0].join("|");
}

export function getCached(p: SearchParams): SearchResponse | undefined {
  const key = cacheKey(p);
  const hit = cache.get(key);
  if (hit) {
    cache.delete(key); // refresh recency
    cache.set(key, hit);
  }
  return hit;
}

function putCached(p: SearchParams, r: SearchResponse) {
  cache.set(cacheKey(p), r);
  if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value as string);
}

export function normaliseQuery(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, MAX_QUERY_LENGTH);
}

export async function searchApi(p: SearchParams, signal?: AbortSignal): Promise<SearchResponse> {
  const q = normaliseQuery(p.q);
  const params = { ...p, q };
  const cached = getCached(params);
  if (cached) return cached;

  const qs = new URLSearchParams({ q, limit: String(p.limit ?? 8) });
  if (p.type && p.type !== "all") qs.set("type", p.type);
  if (p.category) qs.set("category", p.category);
  if (p.sort && p.sort !== "relevance") qs.set("sort", p.sort);
  if (p.offset) qs.set("offset", String(p.offset));

  let res: Response;
  try {
    res = await fetch(`/api/search?${qs}`, { signal, headers: { Accept: "application/json" } });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new SearchUnavailableError();
  }
  if (res.status >= 500 || res.status === 404) throw new SearchUnavailableError();
  if (!res.ok) throw new Error(res.status === 429 ? "Too many searches — wait a moment." : `Search failed (${res.status})`);

  const body = (await res.json()) as Partial<SearchResponse>;
  const out: SearchResponse = { query: body.query ?? q, groups: Array.isArray(body.groups) ? body.groups : [], hasMore: !!body.hasMore };
  putCached(params, out);
  return out;
}

export function countItems(r: SearchResponse | null | undefined): number {
  return r ? r.groups.reduce((n, g) => n + g.items.length, 0) : 0;
}

/* ---------------------------------------------------------------------------------------------
 * Recent searches: per-browser convenience only. Storage can throw (private mode, blocked site
 * data), so every access is guarded and the UI works without it.
 * ------------------------------------------------------------------------------------------- */
const RECENT_KEY = "mx-recent-searches";
const RECENT_LIMIT = 5;

export function readRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((s): s is string => typeof s === "string").slice(0, RECENT_LIMIT) : [];
  } catch {
    return [];
  }
}

function writeRecent(list: string[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

export function addRecent(query: string): string[] {
  const q = normaliseQuery(query);
  if (q.length < MIN_QUERY_LENGTH) return readRecent();
  const next = [q, ...readRecent().filter((r) => r.toLowerCase() !== q.toLowerCase())].slice(0, RECENT_LIMIT);
  writeRecent(next);
  return next;
}

export function removeRecent(query: string): string[] {
  const next = readRecent().filter((r) => r !== query);
  writeRecent(next);
  return next;
}

export function clearRecent(): string[] {
  writeRecent([]);
  return [];
}

/**
 * Curated, shipped with the bundle — so they are always available, including offline. Chosen from what
 * the catalogue is strongest in; update alongside merchandising.
 */
export const POPULAR_SEARCHES = ["Clutch plate", "Brake shoe", "Hero Splendor", "Chain sprocket kit", "Headlight assembly"];
