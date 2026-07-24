import type { ChangelogEntryMeta, ChangelogFilters } from "./changelog";
import {
  EMPTY_FILTERS,
  feedUrl,
  filterEntries,
  fmtEntryDate,
  matchesFilters,
  relativeDate,
} from "./changelog";

const entry = (
  overrides: Partial<ChangelogEntryMeta> = {},
): ChangelogEntryMeta => ({
  area: undefined,
  date: "2026-07-10",
  product: "pyth-core",
  slug: "2026-07-10-example",
  title: "Example",
  type: "feature",
  ...overrides,
});

const filters = (
  overrides: Partial<ChangelogFilters> = {},
): ChangelogFilters => ({
  areas: [],
  products: [],
  types: [],
  ...overrides,
});

describe("matchesFilters", () => {
  it("matches every entry under EMPTY_FILTERS", () => {
    expect(matchesFilters(entry(), EMPTY_FILTERS)).toBe(true);
  });

  it("filters by a single product value", () => {
    const f = filters({ products: ["pyth-core"] });
    expect(matchesFilters(entry({ product: "pyth-core" }), f)).toBe(true);
    expect(matchesFilters(entry({ product: "entropy" }), f)).toBe(false);
  });

  it("ORs multiple values within one facet", () => {
    const f = filters({ products: ["pyth-core", "entropy"] });
    expect(matchesFilters(entry({ product: "entropy" }), f)).toBe(true);
    expect(matchesFilters(entry({ product: "pyth-pro" }), f)).toBe(false);
  });

  it("ANDs across facets", () => {
    const f = filters({ products: ["pyth-pro"], types: ["feature"] });
    expect(
      matchesFilters(entry({ product: "pyth-pro", type: "feature" }), f),
    ).toBe(true);
    expect(matchesFilters(entry({ product: "pyth-pro", type: "fix" }), f)).toBe(
      false,
    );
  });

  it("excludes an entry without an area when an area filter is set", () => {
    const f = filters({ areas: ["apis"] });
    expect(matchesFilters(entry({ area: undefined }), f)).toBe(false);
    expect(matchesFilters(entry({ area: "apis" }), f)).toBe(true);
  });
});

describe("filterEntries", () => {
  it("returns the matching subset in input order", () => {
    const a = entry({ product: "pyth-core", slug: "a" });
    const b = entry({ product: "entropy", slug: "b" });
    const c = entry({ product: "pyth-core", slug: "c" });
    expect(
      filterEntries([a, b, c], filters({ products: ["pyth-core"] })),
    ).toEqual([a, c]);
  });
});

describe("feedUrl", () => {
  it("builds the all-products and per-product feed URLs", () => {
    expect(feedUrl()).toBe("/changelog/feed.xml");
    expect(feedUrl("pyth-pro")).toBe("/changelog/feed.xml?product=pyth-pro");
  });
});

describe("fmtEntryDate", () => {
  it("formats an ISO date in UTC regardless of host timezone", () => {
    expect(fmtEntryDate("2026-07-02")).toBe("July 2, 2026");
    expect(fmtEntryDate("2026-01-01")).toBe("January 1, 2026");
  });
});

describe("relativeDate", () => {
  it("is stable across the UTC day (does not tip a day early at/after noon)", () => {
    const afternoon = new Date("2026-07-20T14:00:00Z");
    expect(relativeDate("2026-07-20", afternoon)).toBe("Today");
    expect(relativeDate("2026-07-19", afternoon)).toBe("Yesterday");
    expect(relativeDate("2026-07-15", afternoon)).toBe("5 days ago");

    const morning = new Date("2026-07-20T06:00:00Z");
    expect(relativeDate("2026-07-20", morning)).toBe("Today");
    expect(relativeDate("2026-07-15", morning)).toBe("5 days ago");
  });

  it("rounds to whole months past 30 days", () => {
    const now = new Date("2026-07-20T14:00:00Z");
    expect(relativeDate("2026-06-20", now)).toBe("1 month ago");
    expect(relativeDate("2026-05-20", now)).toBe("2 months ago");
  });
});
