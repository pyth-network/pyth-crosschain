import type { ChangelogEntryMeta, ChangelogFilters } from "./changelog";
import {
  compareEntriesForDisplay,
  EMPTY_FILTERS,
  feedUrl,
  filterEntries,
  fmtEntryDate,
  isChangelogProduct,
  isChangelogType,
  matchesFilters,
  parseProductParam,
  parseTypeParam,
  relativeDate,
  resolveDeepLink,
  slugFromPath,
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
  it("builds the unfiltered feed URL when given no facets", () => {
    expect(feedUrl()).toBe("/changelog/feed.xml");
    expect(feedUrl({})).toBe("/changelog/feed.xml");
  });

  it("narrows on a single facet", () => {
    expect(feedUrl({ product: "pyth-pro" })).toBe(
      "/changelog/feed.xml?product=pyth-pro",
    );
    expect(feedUrl({ type: "breaking-change" })).toBe(
      "/changelog/feed.xml?type=breaking-change",
    );
  });

  it("combines both facets, product first", () => {
    expect(feedUrl({ product: "entropy", type: "feature" })).toBe(
      "/changelog/feed.xml?product=entropy&type=feature",
    );
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

  it("collapses a future/post-dated entry to Today", () => {
    const now = new Date("2026-07-20T14:00:00Z");
    expect(relativeDate("2026-07-21", now)).toBe("Today");
  });
});

describe("isChangelogProduct", () => {
  it("narrows only recognised product ids", () => {
    expect(isChangelogProduct("pyth-pro")).toBe(true);
    expect(isChangelogProduct("entropy")).toBe(true);
    expect(isChangelogProduct("nope")).toBe(false);
    expect(isChangelogProduct("")).toBe(false);
  });
});

describe("isChangelogType", () => {
  it("narrows only recognised type ids", () => {
    expect(isChangelogType("feature")).toBe(true);
    expect(isChangelogType("breaking-change")).toBe(true);
    expect(isChangelogType("pyth-pro")).toBe(false);
    expect(isChangelogType("")).toBe(false);
  });
});

describe("parseProductParam", () => {
  it("treats absent or empty as the all-products feed", () => {
    expect(parseProductParam(null)).toEqual({ ok: true, value: null });
    expect(parseProductParam("")).toEqual({ ok: true, value: null });
  });

  it("narrows a recognised value to that product", () => {
    expect(parseProductParam("pyth-core")).toEqual({
      ok: true,
      value: "pyth-core",
    });
  });

  it("reports an unrecognised value as unknown", () => {
    expect(parseProductParam("bogus")).toEqual({ ok: false, value: "bogus" });
  });

  it("does not accept a type id", () => {
    expect(parseProductParam("feature")).toEqual({
      ok: false,
      value: "feature",
    });
  });
});

describe("parseTypeParam", () => {
  it("treats absent or empty as the all-types feed", () => {
    expect(parseTypeParam(null)).toEqual({ ok: true, value: null });
    expect(parseTypeParam("")).toEqual({ ok: true, value: null });
  });

  it("narrows a recognised value to that type", () => {
    expect(parseTypeParam("breaking-change")).toEqual({
      ok: true,
      value: "breaking-change",
    });
  });

  it("reports an unrecognised value as unknown", () => {
    expect(parseTypeParam("bogus")).toEqual({ ok: false, value: "bogus" });
  });

  it("does not accept a product id", () => {
    expect(parseTypeParam("entropy")).toEqual({ ok: false, value: "entropy" });
  });
});

describe("compareEntriesForDisplay", () => {
  it("orders newest first", () => {
    const older = entry({ date: "2026-07-01", slug: "a" });
    const newer = entry({ date: "2026-07-10", slug: "b" });
    expect([older, newer].sort(compareEntriesForDisplay)).toEqual([
      newer,
      older,
    ]);
  });

  it("breaks equal dates by ascending title", () => {
    const beta = entry({ date: "2026-07-10", title: "Beta" });
    const alpha = entry({ date: "2026-07-10", title: "Alpha" });
    expect([beta, alpha].sort(compareEntriesForDisplay)).toEqual([alpha, beta]);
  });
});

describe("slugFromPath", () => {
  it("strips the .mdx extension", () => {
    expect(slugFromPath("2026-07-10-example.mdx")).toBe("2026-07-10-example");
  });

  it("leaves a path without the extension unchanged", () => {
    expect(slugFromPath("2026-07-10-example")).toBe("2026-07-10-example");
  });
});

describe("resolveDeepLink", () => {
  const entries = [
    entry({ product: "pyth-pro", slug: "pro" }),
    entry({ product: "entropy", slug: "entropy" }),
  ];

  it("returns undefined for an empty or unknown slug", () => {
    expect(resolveDeepLink(entries, EMPTY_FILTERS, "")).toBeUndefined();
    expect(resolveDeepLink(entries, EMPTY_FILTERS, "missing")).toBeUndefined();
  });

  it("keeps the URL filters when they do not hide the target", () => {
    const f = filters({ products: ["pyth-pro"] });
    expect(resolveDeepLink(entries, f, "pro")).toEqual({
      filters: f,
      index: 0,
    });
  });

  it("drops the filters (returns EMPTY_FILTERS) when they hide the target", () => {
    const f = filters({ products: ["entropy"] });
    const resolved = resolveDeepLink(entries, f, "pro");
    expect(resolved).toEqual({ filters: EMPTY_FILTERS, index: 0 });
    expect(resolved?.filters).toBe(EMPTY_FILTERS);
  });
});
