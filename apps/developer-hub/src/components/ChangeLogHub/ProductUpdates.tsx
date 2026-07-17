"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

import type { ChangelogEntryMeta, ChangelogFilters } from "../../lib/changelog";
import {
  CHANGELOG_AREAS,
  CHANGELOG_PRODUCTS,
  CHANGELOG_TYPES,
  EMPTY_FILTERS,
  filterEntries,
  fmtEntryDate,
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
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const filters = useMemo(
    () => readFilters(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );

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
    const params = new URLSearchParams(searchParams.toString());
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

  // Deep-link support: opening #<entry-slug> scrolls to and highlights the
  // entry. If the active filters would hide it, drop them — a shared link
  // should always land on its entry.
  const [highlighted, setHighlighted] = useState<string | undefined>(undefined);
  useEffect(() => {
    const slug = window.location.hash.replace(/^#/, "");
    const index = entries.findIndex((entry) => entry.slug === slug);
    const entry = entries[index];
    if (slug === "" || entry === undefined) {
      return;
    }
    if (
      !matchesFilters(
        entry,
        readFilters(new URLSearchParams(window.location.search)),
      )
    ) {
      const params = new URLSearchParams(window.location.search);
      params.delete("product");
      params.delete("type");
      params.delete("area");
      const qs = params.toString();
      router.replace(
        `${qs === "" ? pathname : `${pathname}?${qs}`}${window.location.hash}`,
        { scroll: false },
      );
    }
    setLimit((l) => Math.max(l, index + 1));
    setHighlighted(slug);
    const scrollTimer = window.setTimeout(() => {
      document
        .getElementById(slug)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
    const clearTimer = window.setTimeout(() => {
      setHighlighted(undefined);
    }, 2600);
    return () => {
      window.clearTimeout(scrollTimer);
      window.clearTimeout(clearTimer);
    };
  }, [entries, pathname, router]);

  // Group the visible window by date, preserving the date-desc ordering.
  const groups: [string, ProductUpdatesEntry[]][] = [];
  for (const entry of filtered.slice(0, limit)) {
    const last = groups.at(-1);
    if (last && last[0] === entry.date) {
      last[1].push(entry);
    } else {
      groups.push([entry.date, [entry]]);
    }
  }

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
        <div className={styles.emptyState}>
          {entries.length === 0
            ? "No product updates yet — check back soon."
            : "No entries match these filters."}
        </div>
      ) : (
        <div className={styles.groups}>
          {groups.map(([date, dayEntries]) => (
            <section className={styles.group} key={date}>
              <h2 className={styles.groupDate}>{fmtEntryDate(date)}</h2>
              <div className={styles.groupEntries}>
                {dayEntries.map((entry) => (
                  <EntryCard
                    entry={entry}
                    isHighlighted={entry.slug === highlighted}
                    key={entry.slug}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {filtered.length > limit && (
        <button
          className={styles.loadMore}
          onClick={() => {
            setLimit((l) => l + PAGE_SIZE);
          }}
          type="button"
        >
          Load more ({(filtered.length - limit).toString()} remaining)
        </button>
      )}
    </div>
  );
};
