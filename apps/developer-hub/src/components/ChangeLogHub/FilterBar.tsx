"use client";

import { CaretDown, Check } from "@phosphor-icons/react/dist/ssr";
import clsx from "clsx";
import { useState } from "react";

import type { ChangelogFilters } from "../../lib/changelog";
import type { Facet } from "./facets";
import { FACETS } from "./facets";
import styles from "./index.module.scss";

type FilterBarProps = {
  filters: ChangelogFilters;
  hasFilters: boolean;
  filteredCount: number;
  countFor: (facet: Facet, value: string) => number;
  onToggle: (facet: Facet, value: string) => void;
  onClear: () => void;
};

// Sticky filter rail (Product / Type / Area) modelled on the Lazer
// ItemListFilter: a live result count, stacked labelled sections of checkbox
// rows with right-aligned counts, and a "Clear all". Options that match no
// entries are hidden (unless selected) so the rail never advertises dead
// filters; a facet with no visible options drops out entirely. Collapses
// behind a disclosure on mobile.
export const FilterBar = ({
  filters,
  hasFilters,
  filteredCount,
  countFor,
  onToggle,
  onClear,
}: FilterBarProps) => {
  const [open, setOpen] = useState(false);

  return (
    <aside className={styles.rail}>
      <div className={styles.railHead}>
        <span className={styles.railCount}>
          {filteredCount} {filteredCount === 1 ? "update" : "updates"}
        </span>
        {hasFilters && (
          <button className={styles.clear} onClick={onClear} type="button">
            Clear all
          </button>
        )}
        <button
          aria-controls="changelog-facets"
          aria-expanded={open}
          className={clsx(
            styles.filtersToggle,
            open && styles.filtersToggleOpen,
          )}
          onClick={() => {
            setOpen((o) => !o);
          }}
          type="button"
        >
          {open ? "Hide" : "Filters"}
          <CaretDown aria-hidden className={styles.filtersToggleCaret} />
        </button>
      </div>

      <div
        className={clsx(styles.facets, !open && styles.facetsCollapsed)}
        id="changelog-facets"
      >
        {FACETS.map(({ key, label, filterKey, values, labelFor }) => {
          // TS can't correlate `filterKey` with the matching array element type
          // across the union, so the string[] cast is required (TS#30581).
          const selected = filters[filterKey] as string[];
          const visible = values.filter(
            (value) => selected.includes(value) || countFor(key, value) > 0,
          );
          if (visible.length === 0) {
            return null;
          }
          return (
            <div className={styles.facetGroup} key={key}>
              <h4 className={styles.facetHead}>{label}</h4>
              <div aria-label={label} role="group">
                {visible.map((value) => {
                  const active = selected.includes(value);
                  return (
                    <button
                      aria-checked={active}
                      className={clsx(
                        styles.frow,
                        active && styles.frowChecked,
                      )}
                      key={value}
                      onClick={() => {
                        onToggle(key, value);
                      }}
                      role="checkbox"
                      type="button"
                    >
                      <span className={styles.box}>
                        <Check
                          aria-hidden
                          className={styles.boxIcon}
                          weight="bold"
                        />
                      </span>
                      <span className={styles.frowLabel}>
                        {labelFor(value)}
                      </span>
                      <span className={styles.frowCount}>
                        {countFor(key, value)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
};
