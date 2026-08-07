import type { ChangelogEntryMeta, ChangelogFilters } from "../../lib/changelog";
import {
  AREA_LABELS,
  CHANGELOG_AREAS,
  CHANGELOG_PRODUCTS,
  CHANGELOG_TYPES,
  matchesFilters,
  PRODUCT_LABELS,
  TYPE_LABELS,
} from "../../lib/changelog";

// The three filter facets and how they map onto URL params, filter state,
// and display labels. Shared by ProductUpdates (state) and FilterBar (UI).
export type Facet = "product" | "type" | "area";

export const FACETS: {
  key: Facet;
  label: string;
  filterKey: keyof ChangelogFilters;
  values: readonly string[];
  labelFor: (value: string) => string;
}[] = [
  {
    filterKey: "products",
    key: "product",
    label: "Product",
    labelFor: (value) =>
      PRODUCT_LABELS[value as keyof typeof PRODUCT_LABELS] ?? value,
    values: CHANGELOG_PRODUCTS,
  },
  {
    filterKey: "types",
    key: "type",
    label: "Type",
    labelFor: (value) =>
      TYPE_LABELS[value as keyof typeof TYPE_LABELS] ?? value,
    values: CHANGELOG_TYPES,
  },
  {
    filterKey: "areas",
    key: "area",
    label: "Area",
    labelFor: (value) =>
      AREA_LABELS[value as keyof typeof AREA_LABELS] ?? value,
    values: CHANGELOG_AREAS,
  },
];

export const parseListParam = <T extends string>(
  raw: string | null,
  allowed: readonly T[],
): T[] =>
  (raw ?? "")
    .split(",")
    .filter((value): value is T =>
      (allowed as readonly string[]).includes(value),
    );

// The faceted count shown on a chip: how many entries match the *other* facets'
// current selection (this chip's own facet is ignored) and have this facet's
// value. Ignoring the own facet is what lets every option in a facet keep a
// live count while one of them is selected.
export const countForFacet = (
  entries: ChangelogEntryMeta[],
  filters: ChangelogFilters,
  facet: Facet,
  value: string,
): number => {
  const filterKey = FACETS.find((f) => f.key === facet)?.filterKey;
  if (filterKey === undefined) {
    return 0;
  }
  const others: ChangelogFilters = { ...filters, [filterKey]: [] };
  return entries.filter(
    (entry) => matchesFilters(entry, others) && entry[facet] === value,
  ).length;
};
