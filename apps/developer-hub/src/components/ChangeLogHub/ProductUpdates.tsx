"use client";

import { Button } from "@pythnetwork/component-library/Button";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import type { ChangelogEntryMeta, ChangelogFilters } from "../../lib/changelog";
import {
  CHANGELOG_AREAS,
  CHANGELOG_PRODUCTS,
  CHANGELOG_TYPES,
  EMPTY_FILTERS,
  filterEntries,
  matchesFilters,
} from "../../lib/changelog";
import { EntryCard } from "./EntryCard";
import { FilterBar } from "./FilterBar";
import type { Facet } from "./facets";
import { FACETS, parseListParam } from "./facets";
import styles from "./index.module.scss";

export type ProductUpdatesEntry = ChangelogEntryMeta & {
  /** The entry's MDX body, rendered on the server and passed as a node. */
  body: ReactNode;
  /** Coarse relative-time label ("3 days ago"), computed at build time. */
  relative: string;
};

const PAGE_SIZE = 20;

const readFilters = (params: URLSearchParams): ChangelogFilters => ({
  areas: parseListParam(params.get("area"), CHANGELOG_AREAS),
  products: parseListParam(params.get("product"), CHANGELOG_PRODUCTS),
  types: parseListParam(params.get("type"), CHANGELOG_TYPES),
});

export const ProductUpdates = ({
  entries,
}: {
  entries: ProductUpdatesEntry[];
}) => {
  const router = useRouter();
  const pathname = usePathname();

  // Filter state defaults to "no filters" so the full feed renders during the
  // static prerender; it is reconciled from the URL after mount. Reading the
  // URL via useSearchParams during render would bail the whole feed out of the
  // static HTML until hydration.
  const [filters, setFilters] = useState<ChangelogFilters>(EMPTY_FILTERS);

  const hasFilters =
    filters.products.length > 0 ||
    filters.types.length > 0 ||
    filters.areas.length > 0;

  // Pagination window. Reset only on *user-driven* filter changes (below in
  // writeFilters), never via a filters-derived effect — a deep link that
  // programmatically clears filters must be able to raise this limit to reveal
  // its target without a reset effect racing back to PAGE_SIZE.
  const [limit, setLimit] = useState(PAGE_SIZE);

  const writeFilters = (next: ChangelogFilters) => {
    setFilters(next);
    const params = new URLSearchParams(window.location.search);
    const lists: [string, string[]][] = [
      ["product", next.products],
      ["type", next.types],
      ["area", next.areas],
    ];
    for (const [key, values] of lists) {
      if (values.length === 0) {
        params.delete(key);
      } else {
        params.set(key, values.join(","));
      }
    }
    const qs = params.toString();
    router.replace(qs === "" ? pathname : `${pathname}?${qs}`, {
      scroll: false,
    });
    setLimit(PAGE_SIZE);
  };

  const toggle = (facet: Facet, value: string) => {
    const filterKey = FACETS.find((f) => f.key === facet)?.filterKey;
    if (filterKey === undefined) {
      return;
    }
    const current: string[] = filters[filterKey];
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    writeFilters({ ...filters, [filterKey]: next } as ChangelogFilters);
  };

  const clearFilters = () => {
    writeFilters(EMPTY_FILTERS);
  };

  // Faceted counts: for a chip, the number of entries it would match given
  // the *other* facets' current selection (its own facet is ignored).
  const countFor = (facet: Facet, value: string): number => {
    const filterKey = FACETS.find((f) => f.key === facet)?.filterKey;
    if (filterKey === undefined) {
      return 0;
    }
    const others = { ...filters, [filterKey]: [] } as ChangelogFilters;
    return entries.filter(
      (entry) => matchesFilters(entry, others) && entry[facet] === value,
    ).length;
  };

  const filtered = useMemo(
    () => filterEntries(entries, filters),
    [entries, filters],
  );

  const [highlighted, setHighlighted] = useState<string | undefined>(undefined);
  const scrolledFor = useRef<string | undefined>(undefined);

  // Reconcile filters from the URL after mount, and handle deep links: opening
  // #<entry-slug> reveals and highlights the entry, dropping any URL filters
  // that would hide it so a shared link always lands on its target.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlFilters = readFilters(params);
    const slug = window.location.hash.replace(/^#/, "");
    const index = entries.findIndex((entry) => entry.slug === slug);
    const entry = entries[index];

    if (slug === "" || entry === undefined) {
      setFilters(urlFilters);
      return;
    }
    if (matchesFilters(entry, urlFilters)) {
      setFilters(urlFilters);
    } else {
      // Drop the filters that hide the shared entry, in both state and the URL.
      params.delete("product");
      params.delete("type");
      params.delete("area");
      setFilters(EMPTY_FILTERS);
      const qs = params.toString();
      router.replace(
        `${qs === "" ? pathname : `${pathname}?${qs}`}${window.location.hash}`,
        { scroll: false },
      );
    }
    setLimit((l) => Math.max(l, index + 1));
    setHighlighted(slug);
    const clearTimer = window.setTimeout(() => {
      setHighlighted(undefined);
    }, 2600);
    return () => {
      window.clearTimeout(clearTimer);
    };
  }, [entries, pathname, router]);

  const visible = filtered.slice(0, limit);

  // Scroll to a deep-linked entry once it actually mounts. Clearing filters or
  // raising the pagination limit can reveal the target on a *later* render than
  // the one that set `highlighted`, so gate on its presence in `visible` and
  // scroll exactly once (guarded by the ref) rather than on a fixed timer that
  // may fire before the card exists.
  useEffect(() => {
    if (highlighted === undefined || scrolledFor.current === highlighted) {
      return;
    }
    if (!visible.some((entry) => entry.slug === highlighted)) {
      return;
    }
    scrolledFor.current = highlighted;
    document
      .getElementById(highlighted)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [highlighted, visible]);

  return (
    <div>
      <FilterBar
        countFor={countFor}
        filters={filters}
        hasFilters={hasFilters}
        onClear={clearFilters}
        onToggle={toggle}
      />

      {filtered.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyText}>
            {entries.length === 0
              ? "No product updates yet — check back soon."
              : "No updates match these filters."}
          </p>
          {entries.length > 0 && (
            <Button onPress={clearFilters} size="sm" variant="ghost">
              Clear all filters
            </Button>
          )}
        </div>
      ) : (
        <div className={styles.feed}>
          {visible.map((entry) => (
            <EntryCard
              entry={entry}
              isHighlighted={entry.slug === highlighted}
              key={entry.slug}
            />
          ))}
        </div>
      )}

      {filtered.length > limit && (
        <div className={styles.loadMore}>
          <Button
            onPress={() => {
              setLimit((l) => l + PAGE_SIZE);
            }}
            size="sm"
            variant="outline"
          >
            Load more ({(filtered.length - limit).toString()} remaining)
          </Button>
        </div>
      )}
    </div>
  );
};
