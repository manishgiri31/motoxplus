import { describe, expect, it } from "vitest";
import { DEFAULT_SLOW_QUERY_MS, describeSlowQuery, normalizeQueryShape, slowQueryThresholdMs } from "./slow-query";

describe("slowQueryThresholdMs", () => {
  it("defaults to 200ms", () => {
    expect(slowQueryThresholdMs({})).toBe(200);
    expect(DEFAULT_SLOW_QUERY_MS).toBe(200);
  });

  it("honours SLOW_QUERY_MS, including 0 (log everything)", () => {
    expect(slowQueryThresholdMs({ SLOW_QUERY_MS: "75" })).toBe(75);
    expect(slowQueryThresholdMs({ SLOW_QUERY_MS: "0" })).toBe(0);
  });

  it("ignores junk and negatives", () => {
    for (const bad of ["abc", "-5", "", "  "]) expect(slowQueryThresholdMs({ SLOW_QUERY_MS: bad })).toBe(200);
  });
});

describe("normalizeQueryShape", () => {
  it("squeezes whitespace and masks placeholders", () => {
    expect(normalizeQueryShape('SELECT *\n  FROM "Product"\n WHERE id = $1 AND "isActive" = $2')).toBe(
      'SELECT * FROM "Product" WHERE id = $? AND "isActive" = $?'
    );
  });

  it("gives IN lists of different lengths the same shape", () => {
    const three = normalizeQueryShape('SELECT 1 FROM "Product" WHERE id IN ($1,$2,$3) LIMIT $4');
    const forty = normalizeQueryShape(`SELECT 1 FROM "Product" WHERE id IN (${Array.from({ length: 40 }, (_, i) => `$${i + 1}`).join(",")}) LIMIT $41`);
    expect(three).toBe(forty);
    expect(three).toContain("IN ($?...)");
  });

  it("makes different filters on the same table distinct shapes", () => {
    expect(normalizeQueryShape('SELECT 1 FROM "Order" WHERE status = $1')).not.toBe(
      normalizeQueryShape('SELECT 1 FROM "Order" WHERE "dealerId" = $1')
    );
  });
});

describe("describeSlowQuery", () => {
  const q = 'SELECT "id" FROM "User" WHERE "email" = $1';

  it("ignores queries under the threshold", () => {
    expect(describeSlowQuery({ query: q, duration: 199 }, 200)).toBeNull();
    expect(describeSlowQuery({ query: q, duration: 3 }, 200)).toBeNull();
  });

  it("reports queries at or over the threshold", () => {
    expect(describeSlowQuery({ query: q, duration: 200 }, 200)).toMatchObject({ durationMs: 200, thresholdMs: 200 });
    expect(describeSlowQuery({ query: q, duration: 1840, target: "quaint::connector::metrics" }, 200)).toMatchObject({
      durationMs: 1840,
      shape: 'SELECT "id" FROM "User" WHERE "email" = $?',
    });
  });

  it("never returns bound parameters, even if the event carries them", () => {
    const event = { query: q, duration: 500, params: '["dealer@example.com"]' } as never;
    expect(JSON.stringify(describeSlowQuery(event, 200))).not.toContain("dealer@example.com");
  });

  it("truncates enormous statements", () => {
    const big = `SELECT ${"\"col\", ".repeat(2000)} 1 FROM "Product"`;
    const out = describeSlowQuery({ query: big, duration: 900 }, 200);
    expect(out!.shape.length).toBeLessThan(1600);
    expect(out!.shape.endsWith("...[truncated]")).toBe(true);
  });

  it("treats a missing duration as not slow", () => {
    expect(describeSlowQuery({ query: q, duration: NaN }, 200)).toBeNull();
    expect(describeSlowQuery({ query: q } as never, 200)).toBeNull();
  });

  it("with a 0ms threshold logs everything", () => {
    expect(describeSlowQuery({ query: q, duration: 0 }, 0)).not.toBeNull();
  });
});
