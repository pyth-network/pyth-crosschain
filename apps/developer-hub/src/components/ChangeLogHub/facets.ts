import type { ChangelogFilters } from "../../lib/changelog";
import {
  AREA_LABELS,
  CHANGELOG_AREAS,
  CHANGELOG_PRODUCTS,
  CHANGELOG_TYPES,
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
