"use client";

import clsx from "clsx";
import { useState } from "react";

import type { ChangelogFilters } from "../../lib/changelog";
import type { Facet } from "./facets";
import { FACETS } from "./facets";
import styles from "./index.module.scss";

const CheckIcon = () => (
  <svg
    aria-hidden="true"
    className={styles.boxIcon}
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="3.5"
    viewBox="0 0 24 24"
  >
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

const CaretIcon = () => (
  <svg
    aria-hidden="true"
    className={styles.filtersToggleCaret}
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="2"
    viewBox="0 0 24 24"
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
);

type FilterBarProps = {
  filters: ChangelogFilters;
  hasFilters: boolean;
  countFor: (facet: Facet, value: string) => number;
  onToggle: (facet: Facet, value: string) => void;
  onClear: () => void;
};

// Faceted checklist (Product / Type / Area) modelled on the Lazer
// ItemListFilter: labelled sections of checkbox rows with live, right-aligned
// counts and a "Clear all". Collapses behind a disclosure on mobile.
export const FilterBar = ({
  filters,
  hasFilters,
  countFor,
  onToggle,
  onClear,
}: FilterBarProps) => {
  const [open, setOpen] = useState(false);

  return (
    <div className={styles.filters}>
      <div className={styles.filtersHead}>
        <span className={styles.filtersLabel}>Filter</span>
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
          <CaretIcon />
        </button>
        {hasFilters && (
          <button className={styles.clear} onClick={onClear} type="button">
            Clear all
          </button>
        )}
      </div>

      <div
        className={clsx(styles.facets, !open && styles.facetsCollapsed)}
        id="changelog-facets"
      >
        {FACETS.map(({ key, label, filterKey, values, labelFor }) => (
          <div key={key}>
            <h4 className={styles.facetHead}>{label}</h4>
            <div aria-label={label} role="group">
              {values.map((value) => {
                const active = (filters[filterKey] as string[]).includes(value);
                const count = countFor(key, value);
                return (
                  <button
                    aria-checked={active}
                    className={clsx(
                      styles.frow,
                      active && styles.frowChecked,
                      !active && count === 0 && styles.frowEmpty,
                    )}
                    key={value}
                    onClick={() => {
                      onToggle(key, value);
                    }}
                    role="checkbox"
                    type="button"
                  >
                    <span className={styles.box}>
                      <CheckIcon />
                    </span>
                    <span className={styles.frowLabel}>{labelFor(value)}</span>
                    <span className={styles.frowCount}>{count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
