// Shared types, labels, and filter helpers for the cross-product changelog
// at /changelog. This module is pure — safe to import from client components.
// Server-side data access (the fumadocs collection) lives in
// `./changelog-data`; the market-data stream lives in
// `src/components/ChangeLog/data`.

export const CHANGELOG_PRODUCTS = ["pyth-pro", "pyth-core", "entropy"] as const;
export type ChangelogProduct = (typeof CHANGELOG_PRODUCTS)[number];

export const CHANGELOG_TYPES = [
  "feature",
  "fix",
  "breaking-change",
  "deprecation",
  "docs",
] as const;
export type ChangelogType = (typeof CHANGELOG_TYPES)[number];

export const CHANGELOG_AREAS = [
  "apis",
  "terminal",
  "market-data",
  "network",
  "contracts",
  "randomness",
] as const;
export type ChangelogArea = (typeof CHANGELOG_AREAS)[number];

export const PRODUCT_LABELS: Record<ChangelogProduct, string> = {
  entropy: "Entropy",
  "pyth-core": "Pyth Core",
  "pyth-pro": "Pyth Pro",
};

export const TYPE_LABELS: Record<ChangelogType, string> = {
  "breaking-change": "Breaking Change",
  deprecation: "Deprecation",
  docs: "Docs",
  feature: "Feature",
  fix: "Fix",
};

export const AREA_LABELS: Record<ChangelogArea, string> = {
  apis: "APIs",
  contracts: "Contracts",
  "market-data": "Market Data",
  network: "Network",
  randomness: "Randomness",
  terminal: "Terminal",
};

// The shape the client UI works with. Entry bodies (compiled MDX components
// or already-rendered React nodes) are attached by the caller, keeping this
// type free of any server-only concerns.
export type ChangelogEntryMeta = {
  // Stable anchor id — the entry's MDX filename without extension.
  slug: string;
  title: string;
  /** YYYY-MM-DD, UTC. */
  date: string;
  product: ChangelogProduct;
  type: ChangelogType;
  area: ChangelogArea | undefined;
};

export type ChangelogFilters = {
  products: ChangelogProduct[];
  types: ChangelogType[];
  areas: ChangelogArea[];
};

export const EMPTY_FILTERS: ChangelogFilters = {
  areas: [],
  products: [],
  types: [],
};

export const matchesFilters = (
  entry: ChangelogEntryMeta,
  filters: ChangelogFilters,
): boolean =>
  (filters.products.length === 0 || filters.products.includes(entry.product)) &&
  (filters.types.length === 0 || filters.types.includes(entry.type)) &&
  (filters.areas.length === 0 ||
    (entry.area !== undefined && filters.areas.includes(entry.area)));

export const filterEntries = <T extends ChangelogEntryMeta>(
  entries: T[],
  filters: ChangelogFilters,
): T[] => entries.filter((entry) => matchesFilters(entry, filters));

// Resolve a deep link (#slug) against the URL's current filters: locate the
// entry and, when those filters would hide it, drop them so a shared link
// always lands on its target. Returns the filters to apply and the entry's
// index (to raise the pagination window), or undefined when no such entry.
export const resolveDeepLink = (
  entries: ChangelogEntryMeta[],
  urlFilters: ChangelogFilters,
  slug: string,
): { filters: ChangelogFilters; index: number } | undefined => {
  if (slug === "") {
    return undefined;
  }
  const index = entries.findIndex((entry) => entry.slug === slug);
  const entry = entries[index];
  if (entry === undefined) {
    return undefined;
  }
  return {
    filters: matchesFilters(entry, urlFilters) ? urlFilters : EMPTY_FILTERS,
    index,
  };
};

// ─── Entry ordering ──────────────────────────────────────────────────────

// Newest first, ties broken by title so the order is stable across builds.
export const compareEntriesForDisplay = (
  a: ChangelogEntryMeta,
  b: ChangelogEntryMeta,
): number => b.date.localeCompare(a.date) || a.title.localeCompare(b.title);

// The entry's stable anchor slug is its MDX filename without the extension.
export const slugFromPath = (path: string): string =>
  path.replace(/\.mdx$/, "");

// ─── URLs ────────────────────────────────────────────────────────────────

export const CHANGELOG_PATH = "/changelog";

// Canonical origin, used to build shareable permalinks that resolve to the
// docs site regardless of where the copy happens.
export const SITE = "https://docs.pyth.network";

// RSS feed URLs. No `product` → the all-products feed.
export const feedUrl = (product?: ChangelogProduct): string =>
  product === undefined
    ? `${CHANGELOG_PATH}/feed.xml`
    : `${CHANGELOG_PATH}/feed.xml?product=${product}`;

// ─── Product parsing ─────────────────────────────────────────────────────

export const isChangelogProduct = (value: string): value is ChangelogProduct =>
  (CHANGELOG_PRODUCTS as readonly string[]).includes(value);

// Parse the RSS `?product=` query param: an absent or empty value means the
// all-products feed, a recognised value narrows to that product, and anything
// else is reported as unknown so the caller can reject it.
export const parseProductParam = (
  raw: string | null,
):
  | { ok: true; product: ChangelogProduct | null }
  | { ok: false; value: string } => {
  const value = raw ?? "";
  if (value === "") {
    return { ok: true, product: null };
  }
  if (isChangelogProduct(value)) {
    return { ok: true, product: value };
  }
  return { ok: false, value };
};

// ─── Display helpers ─────────────────────────────────────────────────────

export const fmtEntryDate = (iso: string): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
    year: "numeric",
  });
};

// Coarse relative label ("Yesterday", "3 days ago", "2 months ago"), computed
// at build time. A changelog only needs approximate recency, so drift between
// builds is fine.
export const relativeDate = (iso: string, now: Date = new Date()): string => {
  // Difference whole UTC calendar days: compare the entry's UTC midnight to
  // *today's* UTC midnight, not to `now` itself. Using `now` directly would
  // fold in the current time-of-day and tip the label over a day early for
  // any render at/after 12:00 UTC.
  const startOfToday = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  const days = (startOfToday - Date.parse(`${iso}T00:00:00Z`)) / 86_400_000;
  if (days <= 0) {
    return "Today";
  }
  if (days === 1) {
    return "Yesterday";
  }
  if (days < 30) {
    return `${days} days ago`;
  }
  const months = Math.round(days / 30);
  return months === 1 ? "1 month ago" : `${months} months ago`;
};
