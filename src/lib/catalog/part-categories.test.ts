import { beforeEach, describe, expect, it, vi } from "vitest";

const categoryFindMany = vi.fn();
const linkFindMany = vi.fn();

vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    category: { findMany: (...a: unknown[]) => categoryFindMany(...a) },
    vendorPartCategory: { findMany: (...a: unknown[]) => linkFindMany(...a) },
  },
}));

const { validatePartCategoryIds, getVendorListableCategoryIds } = await import("./part-categories");

const tree = [
  { id: "g1", name: "Brake System", slug: "brake-system", children: [{ id: "pads", name: "Brake Pads", slug: "brake-pads" }, { id: "discs", name: "Brake Discs", slug: "brake-discs" }] },
  { id: "g2", name: "Body Parts", slug: "body-parts", children: [{ id: "mud", name: "Mudguards", slug: "mudguards" }] },
];

describe("validatePartCategoryIds", () => {
  beforeEach(() => {
    categoryFindMany.mockReset().mockResolvedValue(tree);
    linkFindMany.mockReset();
  });

  it("reads only active groups that have active subcategories", async () => {
    await validatePartCategoryIds(["pads"]);
    expect(categoryFindMany.mock.calls[0][0].where).toEqual({
      isActive: true, parentId: null, children: { some: { isActive: true } },
    });
  });

  it("accepts known ids and normalises them", async () => {
    expect(await validatePartCategoryIds(["discs", "pads", "mud"])).toEqual({ ok: true, ids: ["g1", "g2"] }); // "mud" is Body Parts' only child, so it collapses
  });

  it("rejects an empty selection without a query", async () => {
    expect(await validatePartCategoryIds([])).toMatchObject({ ok: false });
    expect(categoryFindMany).not.toHaveBeenCalled();
  });

  it("rejects unknown or deactivated ids", async () => {
    const r = await validatePartCategoryIds(["pads", "some-inactive-id"]);
    expect(r.ok).toBe(false);
  });
});

describe("getVendorListableCategoryIds", () => {
  beforeEach(() => {
    categoryFindMany.mockReset().mockResolvedValue(tree);
    linkFindMany.mockReset();
  });

  it("returns null for vendors without part categories (legacy: may list anywhere)", async () => {
    linkFindMany.mockResolvedValue([]);
    expect(await getVendorListableCategoryIds("v1")).toBeNull();
  });

  it("expands an approved group to its subcategories", async () => {
    linkFindMany.mockResolvedValue([{ categoryId: "g1" }, { categoryId: "mud" }]);
    expect([...(await getVendorListableCategoryIds("v1"))!].sort()).toEqual(["discs", "g1", "mud", "pads"]);
  });
});
