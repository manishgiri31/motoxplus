import { describe, expect, it } from "vitest";
import {
  MAX_ID_LIST,
  MAX_PAGE,
  MAX_PAGE_SIZE,
  MAX_SEARCH_QUERY_LENGTH,
  clampSearch,
  parseIdList,
  parsePageParam,
  parsePageSizeParam,
} from "./query-limits";

describe("parsePageParam", () => {
  it("leaves valid pages untouched", () => {
    expect(parsePageParam("1")).toBe(1);
    expect(parsePageParam("7")).toBe(7);
    expect(parsePageParam(String(MAX_PAGE))).toBe(MAX_PAGE);
  });

  it("defaults to page 1 when missing", () => {
    expect(parsePageParam(undefined)).toBe(1);
    expect(parsePageParam(null)).toBe(1);
    expect(parsePageParam("")).toBe(1);
  });

  it("turns junk, zero and negatives into page 1 instead of a NaN/negative OFFSET", () => {
    for (const bad of ["abc", "NaN", "0", "-1", "-99999", "1e400", "  ", "null"]) {
      expect(parsePageParam(bad)).toBe(1);
    }
  });

  it("caps absurd pages so the database never scans a giant OFFSET", () => {
    expect(parsePageParam("99999999")).toBe(MAX_PAGE);
    expect(parsePageParam("9999999999999999999999")).toBe(MAX_PAGE);
  });

  it("reads the first value when the param is repeated (?page=2&page=3)", () => {
    expect(parsePageParam(["2", "3"])).toBe(2);
  });

  it("parses the leading integer like parseInt did (so '3abc' stays page 3)", () => {
    expect(parsePageParam("3abc")).toBe(3);
    expect(parsePageParam("2.9")).toBe(2);
  });
});

describe("parsePageSizeParam", () => {
  it("keeps sizes in range, including the real callers (10, 12, 50)", () => {
    for (const n of [1, 8, 10, 12, 50, MAX_PAGE_SIZE]) expect(parsePageSizeParam(String(n), 12)).toBe(n);
  });

  it("falls back to the default for missing, junk or non-positive values", () => {
    for (const bad of [undefined, null, "", "abc", "0", "-5"]) expect(parsePageSizeParam(bad, 12)).toBe(12);
  });

  it("caps oversized requests rather than returning the whole table", () => {
    expect(parsePageSizeParam("100000", 12)).toBe(MAX_PAGE_SIZE);
    expect(parsePageSizeParam("500", 12, 50)).toBe(50);
  });
});

describe("clampSearch", () => {
  it("trims and passes normal terms through", () => {
    expect(clampSearch("  brake pad ")).toBe("brake pad");
  });

  it("returns undefined for empty input", () => {
    expect(clampSearch(undefined)).toBeUndefined();
    expect(clampSearch(null)).toBeUndefined();
    expect(clampSearch("   ")).toBeUndefined();
  });

  it("truncates to the maximum length", () => {
    expect(clampSearch("x".repeat(5000))).toHaveLength(MAX_SEARCH_QUERY_LENGTH);
    expect(clampSearch("x".repeat(50), 10)).toHaveLength(10);
  });

  it("keeps unicode and SQL-ish characters as plain text (escaping is the query layer's job)", () => {
    expect(clampSearch("बैटरी 100%_")).toBe("बैटरी 100%_");
    expect(clampSearch("'; DROP TABLE \"Product\"; --")).toBe("'; DROP TABLE \"Product\"; --");
  });
});

describe("parseIdList", () => {
  it("splits, trims and drops blanks", () => {
    expect(parseIdList("a, b,,c ,")).toEqual(["a", "b", "c"]);
  });

  it("handles missing input", () => {
    expect(parseIdList(null)).toEqual([]);
    expect(parseIdList(undefined)).toEqual([]);
    expect(parseIdList("")).toEqual([]);
  });

  it("caps the number of ids", () => {
    const many = Array.from({ length: 5000 }, (_, i) => `id${i}`).join(",");
    expect(parseIdList(many)).toHaveLength(MAX_ID_LIST);
    expect(parseIdList(many)[0]).toBe("id0");
  });
});
