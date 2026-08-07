import type { ChangelogEntryMeta, ChangelogFilters } from "../../lib/changelog";
import { CHANGELOG_PRODUCTS, EMPTY_FILTERS } from "../../lib/changelog";
import { countForFacet, parseListParam } from "./facets";

const entry = (
  overrides: Partial<ChangelogEntryMeta> = {},
): ChangelogEntryMeta => ({
  area: undefined,
  date: "2026-07-10",
  product: "pyth-core",
  slug: "s",
  title: "t",
  type: "feature",
  ...overrides,
});

describe("parseListParam", () => {
  it("returns an empty list for null or empty input", () => {
    expect(parseListParam(null, CHANGELOG_PRODUCTS)).toEqual([]);
    expect(parseListParam("", CHANGELOG_PRODUCTS)).toEqual([]);
  });

  it("keeps only allowed values, preserving order", () => {
    expect(parseListParam("entropy,pyth-pro", CHANGELOG_PRODUCTS)).toEqual([
      "entropy",
      "pyth-pro",
    ]);
  });

  it("drops values outside the allowed set", () => {
    expect(parseListParam("pyth-pro,bogus", CHANGELOG_PRODUCTS)).toEqual([
      "pyth-pro",
    ]);
  });

  it("keeps duplicates (does not dedupe)", () => {
    expect(parseListParam("pyth-pro,pyth-pro", CHANGELOG_PRODUCTS)).toEqual([
      "pyth-pro",
      "pyth-pro",
    ]);
  });

  it("does not trim whitespace-padded values", () => {
    expect(parseListParam(" pyth-pro", CHANGELOG_PRODUCTS)).toEqual([]);
  });
});

describe("countForFacet", () => {
  const entries: ChangelogEntryMeta[] = [
    entry({ product: "pyth-pro", type: "feature" }),
    entry({ product: "pyth-pro", type: "fix" }),
    entry({ product: "pyth-core", type: "feature" }),
    entry({ product: "entropy", type: "docs" }),
  ];

  it("counts entries with the facet value when there are no filters", () => {
    expect(countForFacet(entries, EMPTY_FILTERS, "product", "pyth-pro")).toBe(
      2,
    );
    expect(countForFacet(entries, EMPTY_FILTERS, "type", "feature")).toBe(2);
  });

  it("ignores the chip's own facet so its options keep live counts", () => {
    const withPro: ChangelogFilters = {
      areas: [],
      products: ["pyth-pro"],
      types: [],
    };
    // A selected Product must not shrink the other Product options' counts.
    expect(countForFacet(entries, withPro, "product", "pyth-core")).toBe(1);
    expect(countForFacet(entries, withPro, "product", "pyth-pro")).toBe(2);
  });

  it("applies the other facets when counting", () => {
    const featureOnly: ChangelogFilters = {
      areas: [],
      products: [],
      types: ["feature"],
    };
    expect(countForFacet(entries, featureOnly, "product", "pyth-pro")).toBe(1);
    expect(countForFacet(entries, featureOnly, "product", "entropy")).toBe(0);
  });
});
