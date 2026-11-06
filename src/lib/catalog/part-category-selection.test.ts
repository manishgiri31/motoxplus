import { describe, expect, it } from "vitest";
import {
  countSelectedSubcategories,
  expandSelection,
  filterGroups,
  groupState,
  normalizeSelection,
  selectionChips,
  toggleChild,
  toggleGroup,
  type PartCategoryGroup,
} from "./part-category-selection";

const tree: PartCategoryGroup[] = [
  {
    id: "g-fast", name: "Screws, Nuts & Fasteners", slug: "screws-nuts-fasteners",
    children: [
      { id: "screws", name: "Screws", slug: "screws" },
      { id: "nuts", name: "Nuts", slug: "nuts" },
      { id: "bolts", name: "Bolts", slug: "bolts" },
    ],
  },
  {
    id: "g-elec", name: "Electrical Parts", slug: "electrical-parts",
    children: [
      { id: "harness", name: "Wiring Harness", slug: "wiring-harness" },
      { id: "coil", name: "Ignition Coil", slug: "ignition-coil" },
    ],
  },
];

describe("normalizeSelection", () => {
  it("dedupes, drops unknown ids and returns tree order", () => {
    expect(normalizeSelection(tree, ["coil", "bogus", "nuts", "nuts"])).toEqual(["nuts", "coil"]);
  });

  it("drops children covered by a selected group", () => {
    expect(normalizeSelection(tree, ["screws", "g-fast", "coil"])).toEqual(["g-fast", "coil"]);
  });

  it("collapses a fully selected group into the group id", () => {
    expect(normalizeSelection(tree, ["harness", "coil"])).toEqual(["g-elec"]);
  });
});

describe("toggling", () => {
  it("group checkbox selects the whole group, then clears it", () => {
    const on = toggleGroup(tree, ["screws", "coil"], "g-fast");
    expect(on).toEqual(["g-fast", "coil"]);
    expect(toggleGroup(tree, on, "g-fast")).toEqual(["coil"]);
  });

  it("unticking one child of a full group keeps its siblings", () => {
    expect(toggleChild(tree, ["g-fast"], "nuts")).toEqual(["screws", "bolts"]);
  });

  it("ticking the last missing child collapses to the group", () => {
    expect(toggleChild(tree, ["screws", "bolts"], "nuts")).toEqual(["g-fast"]);
  });

  it("reports group state", () => {
    expect(groupState(tree[0], new Set(["g-fast"]))).toBe("all");
    expect(groupState(tree[0], new Set(["nuts"]))).toBe("some");
    expect(groupState(tree[0], new Set())).toBe("none");
  });
});

describe("search", () => {
  it("a matching group shows all of its subcategories", () => {
    expect(filterGroups(tree, "electrical")[0].children).toHaveLength(2);
  });

  it("otherwise only matching subcategories, case-insensitive", () => {
    const r = filterGroups(tree, "BOL");
    expect(r).toHaveLength(1);
    expect(r[0].children.map((c) => c.id)).toEqual(["bolts"]);
  });

  it("matches words across group and subcategory names", () => {
    expect(filterGroups(tree, "electrical coil")[0].children.map((c) => c.id)).toEqual(["coil"]);
    expect(filterGroups(tree, "zzz")).toEqual([]);
  });
});

describe("chips and expansion", () => {
  it("labels group chips with the group name and child chips with their group", () => {
    expect(selectionChips(tree, ["g-elec", "nuts"])).toEqual([
      { id: "g-elec", label: "Electrical Parts", isGroup: true },
      { id: "nuts", label: "Nuts", groupName: "Screws, Nuts & Fasteners", isGroup: false },
    ]);
  });

  it("expands groups to every subcategory for product listing", () => {
    expect([...expandSelection(tree, ["g-elec", "nuts"])].sort()).toEqual(["coil", "g-elec", "harness", "nuts"]);
    expect(countSelectedSubcategories(tree, ["g-elec", "nuts"])).toBe(3);
  });
});
