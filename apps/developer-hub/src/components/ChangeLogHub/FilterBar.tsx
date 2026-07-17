"use client";

import clsx from "clsx";

import type { ChangelogFilters, ChangelogType } from "../../lib/changelog";
import type { Facet } from "./facets";
import { FACETS } from "./facets";
import styles from "./index.module.scss";

const TYPE_DOT_CLASS: Partial<Record<ChangelogType, string | undefined>> = {
  "breaking-change": styles.typeDotBreaking,
  deprecation: styles.typeDotDeprecation,
  docs: styles.typeDotDocs,
  feature: styles.typeDotFeature,
  fix: styles.typeDotFix,
};

type FilterBarProps = {
  filters: ChangelogFilters;
  hasFilters: boolean;
  countFor: (facet: Facet, value: string) => number;
  onToggle: (facet: Facet, value: string) => void;
  onClear: () => void;
};

export const FilterBar = ({
  filters,
  hasFilters,
  countFor,
  onToggle,
  onClear,
}: FilterBarProps) => (
  <div className={styles.filterBar}>
    {FACETS.map(({ key, label, filterKey, values, labelFor }) => (
      <div className={styles.filterGroup} key={key}>
        <span className={styles.filterGroupLabel}>{label}</span>
        <div aria-label={label} className={styles.filterChips} role="group">
          {values.map((value) => {
            const active = (filters[filterKey] as string[]).includes(value);
            const count = countFor(key, value);
            return (
              <button
                aria-pressed={active}
                className={clsx(
                  styles.filterChip,
                  active && styles.filterChipActive,
                  !active && count === 0 && styles.filterChipEmpty,
                )}
                key={value}
                onClick={() => {
                  onToggle(key, value);
                }}
                type="button"
              >
                {key === "type" && (
                  <span
                    aria-hidden="true"
                    className={clsx(
                      styles.filterDot,
                      TYPE_DOT_CLASS[value as ChangelogType],
                    )}
                  />
                )}
                <span>{labelFor(value)}</span>
                <span className={styles.filterCount}>{count}</span>
              </button>
            );
          })}
        </div>
      </div>
    ))}
    {hasFilters && (
      <button className={styles.filterClear} onClick={onClear} type="button">
        Clear all
      </button>
    )}
  </div>
);
