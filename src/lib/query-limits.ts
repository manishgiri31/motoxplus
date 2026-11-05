/**
 * Bounds for untrusted query-string input on list/search/pagination routes.
 *
 * Before these, `parseInt(searchParams.get("page") || "1")` fed Prisma directly: `?page=abc` became
 * `skip: NaN` (a 500), `?page=-3` a negative offset (a 500), and `?page=99999999` a huge OFFSET the
 * database has to scan past. Free-text search terms and `pageSize` had no ceiling either. Valid input
 * behaves exactly as before; only out-of-range input is clamped.
 */

/** Longest free-text search term any list/search route will use. Real part numbers/names are far shorter. */
export const MAX_SEARCH_QUERY_LENGTH = 100;

/** Highest page number honoured. At 100 rows/page that is 500k rows - beyond any real catalog or ledger. */
export const MAX_PAGE = 5000;

/** Largest `pageSize` a client may request (the biggest real caller, the mobile app, asks for 50). */
export const MAX_PAGE_SIZE = 100;

/** Cap on how many ids a "?ids=a,b,c" parameter may carry. */
export const MAX_ID_LIST = 200;

/** A page number from a raw query value: integers 1..MAX_PAGE; anything else (NaN, 0, negative, junk) becomes 1. */
export function parsePageParam(raw: string | string[] | null | undefined): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const n = parseInt(value ?? "1", 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, MAX_PAGE);
}

/** A page size from a raw query value: integers 1..max; junk or <1 falls back to the default. */
export function parsePageSizeParam(raw: string | null | undefined, defaultSize: number, max = MAX_PAGE_SIZE): number {
  const n = parseInt(raw ?? "", 10);
  if (!Number.isFinite(n) || n < 1) return defaultSize;
  return Math.min(n, max);
}

/** Trims and truncates a free-text term. Returns undefined when nothing usable is left. */
export function clampSearch(raw: string | null | undefined, max = MAX_SEARCH_QUERY_LENGTH): string | undefined {
  const value = raw?.trim().slice(0, max);
  return value ? value : undefined;
}

/** Splits a comma-separated id list, drops blanks and caps the count. */
export function parseIdList(raw: string | null | undefined, max = MAX_ID_LIST): string[] {
  return (raw?.split(",").map((s) => s.trim()).filter(Boolean) ?? []).slice(0, max);
}
