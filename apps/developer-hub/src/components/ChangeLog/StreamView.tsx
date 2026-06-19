"use client";

import clsx from "clsx";
import { useMemo, useState } from "react";

import type { ChangeLog as ChangeLogData, ChangeType } from "./data";
import { dotClassFor, EventRow } from "./EventRow";
import styles from "./index.module.scss";

type FilterKey = "all" | ChangeType;

const FILTERS: { key: FilterKey; label: string; type: ChangeType | null }[] = [
  { key: "all", label: "All", type: null },
  { key: "added", label: "Added", type: "added" },
  { key: "went_live", label: "Went live", type: "went_live" },
  { key: "removed", label: "Removed", type: "removed" },
];

export const StreamView = ({ log }: { log: ChangeLogData }) => {
  const [filter, setFilter] = useState<FilterKey>("all");

  const allEntries = useMemo(
    () => [...log.days].reverse().flatMap((d) => d.events),
    [log.days],
  );

  const counts = useMemo<Record<FilterKey, number>>(
    () => ({
      added: allEntries.filter((e) => e.changeType === "added").length,
      all: allEntries.length,
      removed: allEntries.filter((e) => e.changeType === "removed").length,
      went_live: allEntries.filter((e) => e.changeType === "went_live").length,
    }),
    [allEntries],
  );

  const filtered =
    filter === "all"
      ? allEntries
      : allEntries.filter((e) => e.changeType === filter);

  return (
    <div>
      <div
        aria-label="Filter by change type"
        className={styles.filterRow}
        role="tablist"
      >
        {FILTERS.map(({ key, label, type }) => {
          const active = filter === key;
          return (
            <button
              aria-selected={active}
              className={clsx(
                styles.filterChip,
                active && styles.filterChipActive,
              )}
              key={key}
              onClick={() => {
                setFilter(key);
              }}
              role="tab"
              type="button"
            >
              {type && (
                <span
                  aria-hidden="true"
                  className={clsx(styles.filterDot, dotClassFor(type))}
                />
              )}
              <span>{label}</span>
              <span className={styles.filterCount}>{counts[key]}</span>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className={styles.streamEmpty}>No matching events.</div>
      ) : (
        <div className={styles.eventsList}>
          {filtered.map((e, i) => (
            <EventRow
              entry={e}
              key={`${e.date}-${e.id}-${e.changeType}-${i.toString()}`}
              showDate
            />
          ))}
        </div>
      )}
    </div>
  );
};
