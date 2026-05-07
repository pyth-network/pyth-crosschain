"use client";

import { Bell } from "@phosphor-icons/react/dist/ssr/Bell";
import { Rss } from "@phosphor-icons/react/dist/ssr/Rss";
import clsx from "clsx";
import { Callout } from "fumadocs-ui/components/callout";
import { useEffect, useMemo, useState } from "react";

import {
  fmtDateLong,
  fmtDateShort,
  getChangeLog,
  type ChangeLog as ChangeLogData,
  type ChangeLogEntry,
  type ChangeType,
  type Day,
  type DaySummary,
  type WeekRollup,
} from "./data";
import styles from "./index.module.scss";

type Mode = "day" | "stream";

export const ChangeLog = () => {
  const [state, setState] = useState<State>(State.NotLoaded());

  useEffect(() => {
    setState(State.Loading());
    getChangeLog()
      .then((log) => {
        setState(State.Loaded(log));
      })
      .catch((error: unknown) => {
        setState(State.Failed(error));
      });
  }, []);

  if (state.type === StateType.Error) {
    return <Callout type="error">{errorToString(state.error)}</Callout>;
  }

  if (
    state.type === StateType.NotLoaded ||
    state.type === StateType.Loading
  ) {
    return <div className={styles.loading}>Loading change log…</div>;
  }

  return <ChangeLogView log={state.log} />;
};

const ChangeLogView = ({ log }: { log: ChangeLogData }) => {
  const [mode, setMode] = useState<Mode>("day");
  const lastDay = log.days.at(-1);

  return (
    <div className={styles.root}>
      <MetaBar mode={mode} setMode={setMode} lastUpdated={lastDay?.date} />

      <WeekSummary rollup={log.weekRollup} />

      {log.days.length === 0 ? (
        <div className={styles.emptyState}>
          No transitions yet — daily snapshots are accumulating. Check back
          tomorrow.
        </div>
      ) : mode === "day" ? (
        <div className={styles.days}>
          {[...log.days].reverse().map((day) => (
            <DayView key={day.date} day={day} />
          ))}
        </div>
      ) : (
        <StreamView log={log} />
      )}

      <Footer />
    </div>
  );
};

// ─── Footer ──────────────────────────────────────────────────────────────

const Footer = () => (
  <footer className={styles.footer}>
    <span className={styles.footerNote}>
      Sourced from{" "}
      <a
        className={styles.footerLink}
        href="https://pyth.dourolabs.app/docs/"
        target="_blank"
        rel="noopener noreferrer"
      >
        Symbols API
      </a>
    </span>
    <span className={styles.footerSpacer} />
    {/* TODO: link to the actual file in GitHub once a public URL is decided. */}
    <a className={styles.footerEdit} href="#">
      Edit this page on GitHub →
    </a>
  </footer>
);

// ─── Week summary ────────────────────────────────────────────────────────

type StatKey = keyof DaySummary;

const STATS: { key: StatKey; label: string; modifier: string }[] = [
  { key: "added", label: "added", modifier: "added" },
  { key: "went_live", label: "went live", modifier: "wentLive" },
  { key: "expiring", label: "expiring", modifier: "expiring" },
  { key: "removed", label: "removed", modifier: "removed" },
];

const sumTotals = (t: DaySummary) =>
  t.added + t.went_live + t.expiring + t.removed;

const WeekSummary = ({ rollup }: { rollup: WeekRollup }) => {
  const total = sumTotals(rollup.totals);

  return (
    <section className={styles.weekSummary} aria-labelledby="changelog-week">
      <div className={styles.weekTotal}>
        <h2 id="changelog-week" className={styles.weekHeading}>
          This week
        </h2>
        <div className={styles.weekNumber}>{total}</div>
        <div className={styles.weekRange}>
          {fmtDateShort(rollup.start)} – {fmtDateShort(rollup.end)}
        </div>
      </div>

      <div className={styles.weekDivider} aria-hidden="true" />

      <div className={styles.weekStats}>
        {STATS.map(({ key, label, modifier }) => {
          const value = rollup.totals[key];
          return (
            <div key={key} className={styles.weekStat}>
              <div
                className={clsx(
                  styles.weekStatValue,
                  value > 0 && styles[`weekStatValue_${modifier}`],
                )}
              >
                {value}
              </div>
              <div className={styles.weekStatLabel}>{label}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

// ─── Day view ────────────────────────────────────────────────────────────

const CHANGE_LABELS: Record<ChangeType, string> = {
  added: "added",
  went_live: "went live",
  expiring_soon: "expiring soon",
  removed: "removed",
};

const dotClassFor = (type: ChangeType): string | undefined => {
  switch (type) {
    case "added": {
      return styles.dotAdded;
    }
    case "went_live": {
      return styles.dotWentLive;
    }
    case "expiring_soon": {
      return styles.dotExpiring;
    }
    case "removed": {
      return styles.dotRemoved;
    }
  }
};

const DayView = ({ day }: { day: Day }) => {
  const total = day.events.length;
  const regular = day.events.filter((e) => e.changeType !== "expiring_soon");
  const expiring = day.events.filter((e) => e.changeType === "expiring_soon");

  return (
    <section id={day.date} className={styles.day}>
      <div className={styles.dayHeader}>
        <h2 className={styles.dayDate}>{fmtDateLong(day.date)}</h2>
        <span className={styles.dayLabel}>{day.label.toLowerCase()}</span>
        {total > 0 && (
          <span className={styles.dayCount}>
            {total} change{total === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {total === 0 ? (
        <div className={styles.dayEmpty}>No status transitions today.</div>
      ) : (
        <>
          <p className={styles.dayHero}>{day.hero}</p>

          {regular.length > 0 && (
            <div className={styles.eventsList}>
              {regular.map((e) => (
                <EventRow key={`${e.id}-${e.changeType}`} entry={e} />
              ))}
            </div>
          )}

          {expiring.length > 0 && (
            <ExpiringCallout
              events={expiring}
              hasRegular={regular.length > 0}
            />
          )}
        </>
      )}
    </section>
  );
};

const EventRow = ({
  entry,
  showDate = false,
}: {
  entry: ChangeLogEntry;
  showDate?: boolean;
}) => (
  <div className={clsx(styles.eventRow, showDate && styles.eventRowWithDate)}>
    {showDate && (
      <span className={styles.eventDate}>{fmtDateShort(entry.date)}</span>
    )}
    <span className={styles.eventTag}>
      <span className={clsx(styles.eventDot, dotClassFor(entry.changeType))} />
      {CHANGE_LABELS[entry.changeType]}
    </span>
    <div className={styles.eventInfo}>
      <span className={styles.eventId}>{entry.id}</span>
      <span className={styles.eventAsset}>{entry.asset}</span>
      <span className={styles.eventAssetType}>· {entry.assetType}</span>
    </div>
  </div>
);

const ExpiringCallout = ({
  events,
  hasRegular,
}: {
  events: ChangeLogEntry[];
  hasRegular: boolean;
}) => {
  const maxDays = events.reduce(
    (max, e) => Math.max(max, e.daysToExpiry ?? 0),
    0,
  );

  return (
    <div
      className={clsx(
        styles.expiringCallout,
        !hasRegular && styles.expiringCalloutFirst,
      )}
    >
      <h3 className={styles.expiringHeading}>
        Expiring soon
        <span className={styles.expiringHeadingMuted}>
          {" "}
          — within {maxDays} day{maxDays === 1 ? "" : "s"}
        </span>
      </h3>
      <div className={styles.expiringList}>
        {events.map((e) => (
          <div key={e.id} className={styles.expiringRow}>
            <span className={styles.eventId}>{e.id}</span>
            <span className={styles.eventAsset}>{e.asset}</span>
            <span className={styles.eventAssetType}>· {e.assetType}</span>
            <span className={styles.expiringDays}>
              {e.daysToExpiry} day{e.daysToExpiry === 1 ? "" : "s"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Stream view ─────────────────────────────────────────────────────────

type FilterKey = "all" | ChangeType;

const FILTERS: { key: FilterKey; label: string; type: ChangeType | null }[] = [
  { key: "all", label: "All", type: null },
  { key: "added", label: "Added", type: "added" },
  { key: "went_live", label: "Went live", type: "went_live" },
  { key: "expiring_soon", label: "Expiring", type: "expiring_soon" },
  { key: "removed", label: "Removed", type: "removed" },
];

const StreamView = ({ log }: { log: ChangeLogData }) => {
  const [filter, setFilter] = useState<FilterKey>("all");

  const allEntries = useMemo(
    () => [...log.days].reverse().flatMap((d) => d.events),
    [log.days],
  );

  const counts = useMemo<Record<FilterKey, number>>(
    () => ({
      all: allEntries.length,
      added: allEntries.filter((e) => e.changeType === "added").length,
      went_live: allEntries.filter((e) => e.changeType === "went_live").length,
      expiring_soon: allEntries.filter((e) => e.changeType === "expiring_soon")
        .length,
      removed: allEntries.filter((e) => e.changeType === "removed").length,
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
        className={styles.filterRow}
        role="tablist"
        aria-label="Filter by change type"
      >
        {FILTERS.map(({ key, label, type }) => {
          const active = filter === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                setFilter(key);
              }}
              className={clsx(
                styles.filterChip,
                active && styles.filterChipActive,
              )}
            >
              {type && (
                <span
                  className={clsx(styles.filterDot, dotClassFor(type))}
                  aria-hidden="true"
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
              key={`${e.date}-${e.id}-${e.changeType}-${i.toString()}`}
              entry={e}
              showDate
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Meta bar ────────────────────────────────────────────────────────────

const MetaBar = ({
  mode,
  setMode,
  lastUpdated,
}: {
  mode: Mode;
  setMode: (m: Mode) => void;
  lastUpdated: string | undefined;
}) => (
  <div className={styles.metaBar}>
    <ModeToggle mode={mode} setMode={setMode} />

    {lastUpdated && (
      <span className={styles.updated}>
        <span className={styles.updatedDot} aria-hidden />
        Updated {fmtDateShort(lastUpdated)} UTC
      </span>
    )}

    <span className={styles.spacer} />

    {/* TODO: wire to a real subscribe target (mailing list / Discord). */}
    <a
      className={styles.metaButton}
      href="#"
      aria-label="Subscribe to changelog updates"
    >
      <Bell size={10} weight="regular" />
      Subscribe
    </a>

    {/* TODO: wire to /price-feeds/changelog/rss.xml once the route exists. */}
    <a className={styles.metaButton} href="#" aria-label="RSS feed">
      <Rss size={10} weight="regular" />
      RSS
    </a>
  </div>
);

const ModeToggle = ({
  mode,
  setMode,
}: {
  mode: Mode;
  setMode: (m: Mode) => void;
}) => (
  <div className={styles.modeToggle} role="tablist" aria-label="View mode">
    {(["day", "stream"] as const).map((m) => (
      <button
        key={m}
        type="button"
        role="tab"
        aria-selected={mode === m}
        onClick={() => {
          setMode(m);
        }}
        className={clsx(
          styles.modeToggleButton,
          mode === m && styles.modeToggleButtonActive,
        )}
      >
        {m === "day" ? "By day" : "Stream"}
      </button>
    ))}
  </div>
);

// ─── State machine ───────────────────────────────────────────────────────

enum StateType {
  NotLoaded,
  Loading,
  Loaded,
  Error,
}

const State = {
  NotLoaded: () => ({ type: StateType.NotLoaded as const }),
  Loading: () => ({ type: StateType.Loading as const }),
  Loaded: (log: ChangeLogData) => ({
    type: StateType.Loaded as const,
    log,
  }),
  Failed: (error: unknown) => ({ type: StateType.Error as const, error }),
};
type State = ReturnType<(typeof State)[keyof typeof State]>;

const errorToString = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "An error occurred while loading the change log.";
};
