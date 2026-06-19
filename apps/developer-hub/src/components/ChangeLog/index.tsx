"use client";

import clsx from "clsx";
import { Callout } from "fumadocs-ui/components/callout";
import { useEffect, useMemo, useState } from "react";
import type {
  ChangeLog as ChangeLogData,
  ChangeLogEntry,
  ChangeType,
  Day,
  DaySummary,
  WeekRollup,
} from "./data";
import { fmtDateLong, fmtDateShort, getChangeLog } from "./data";
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

  if (state.type === StateType.NotLoaded || state.type === StateType.Loading) {
    return <div className={styles.loading}>Loading change log…</div>;
  }

  return <ChangeLogView log={state.log} />;
};

const ChangeLogView = ({ log }: { log: ChangeLogData }) => {
  const [mode, setMode] = useState<Mode>("day");
  const [highlighted, setHighlighted] = useState<string | undefined>(undefined);
  const lastDay = log.days.at(-1);

  // Deep-link support: when opened at #<date>, land on that day. Data loads
  // asynchronously, so the browser's native hash scroll fires before the day
  // sections exist; re-run the scroll (and a brief highlight) once data is in.
  useEffect(() => {
    const date = window.location.hash.replace(/^#/, "");
    if (date === "" || !log.days.some((d) => d.date === date)) {
      return;
    }
    setMode("day");
    setHighlighted(date);
    const scrollTimer = window.setTimeout(() => {
      document
        .getElementById(date)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
    const clearTimer = window.setTimeout(() => {
      setHighlighted(undefined);
    }, 2600);
    return () => {
      window.clearTimeout(scrollTimer);
      window.clearTimeout(clearTimer);
    };
  }, [log.days]);

  const renderBody = () => {
    if (log.days.length === 0) {
      return (
        <div className={styles.emptyState}>
          No transitions yet — daily snapshots are accumulating. Check back
          tomorrow.
        </div>
      );
    }
    if (mode === "day") {
      return (
        <div className={styles.days}>
          {[...log.days].reverse().map((day) => (
            <DayView
              day={day}
              isHighlighted={day.date === highlighted}
              key={day.date}
            />
          ))}
        </div>
      );
    }
    return <StreamView log={log} />;
  };

  return (
    <div className={styles.root}>
      <MetaBar lastUpdated={lastDay?.date} mode={mode} setMode={setMode} />

      <WeekSummary rollup={log.weekRollup} />

      {renderBody()}

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
        rel="noopener noreferrer"
        target="_blank"
      >
        Symbols API
      </a>
    </span>
    <span className={styles.footerSpacer} />
    <a
      className={styles.footerEdit}
      href="https://github.com/pyth-network/pyth-crosschain/tree/main/apps/developer-hub/data/changelog-diffs"
      rel="noopener noreferrer"
      target="_blank"
    >
      View source data on GitHub →
    </a>
  </footer>
);

// ─── Week summary ────────────────────────────────────────────────────────

type StatKey = keyof DaySummary;

const STATS: { key: StatKey; label: string; modifier: string }[] = [
  { key: "added", label: "added", modifier: "added" },
  { key: "went_live", label: "went live", modifier: "wentLive" },
  { key: "removed", label: "removed", modifier: "removed" },
];

const sumTotals = (t: DaySummary) => t.added + t.went_live + t.removed;

const WeekSummary = ({ rollup }: { rollup: WeekRollup }) => {
  const total = sumTotals(rollup.totals);

  return (
    <section aria-labelledby="changelog-week" className={styles.weekSummary}>
      <div className={styles.weekTotal}>
        <h2 className={styles.weekHeading} id="changelog-week">
          Last 14 days
        </h2>
        <div className={styles.weekNumber}>{total}</div>
        <div className={styles.weekRange}>
          {fmtDateShort(rollup.start)} – {fmtDateShort(rollup.end)}
        </div>
      </div>

      <div aria-hidden="true" className={styles.weekDivider} />

      <div className={styles.weekStats}>
        {STATS.map(({ key, label, modifier }) => {
          const value = rollup.totals[key];
          return (
            <div className={styles.weekStat} key={key}>
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
  removed: "removed",
  went_live: "went live",
};

const dotClassFor = (type: ChangeType): string | undefined => {
  switch (type) {
    case "added": {
      return styles.dotAdded;
    }
    case "went_live": {
      return styles.dotWentLive;
    }
    case "removed": {
      return styles.dotRemoved;
    }
  }
};

const LinkIcon = () => (
  <svg
    aria-hidden="true"
    className={styles.copyLinkIcon}
    fill="none"
    height="13"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="2"
    viewBox="0 0 24 24"
    width="13"
  >
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);

const CheckIcon = () => (
  <svg
    aria-hidden="true"
    className={styles.copyLinkIcon}
    fill="none"
    height="13"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="2"
    viewBox="0 0 24 24"
    width="13"
  >
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

const CopyLinkButton = ({ date }: { date: string }) => {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    const url = `${window.location.origin}${window.location.pathname}#${date}`;
    window.navigator.clipboard
      .writeText(url)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => {
          setCopied(false);
        }, 1500);
      })
      .catch(() => {
        // Clipboard can reject (insecure context / denied permission); ignore.
      });
  };

  return (
    <button
      aria-label={`Copy link to ${fmtDateLong(date)}`}
      className={clsx(styles.copyLink, copied && styles.copyLinkActive)}
      onClick={copy}
      type="button"
    >
      {copied ? <CheckIcon /> : <LinkIcon />}
      {copied && <span className={styles.copyLinkText}>Copied</span>}
    </button>
  );
};

const DayView = ({
  day,
  isHighlighted,
}: {
  day: Day;
  isHighlighted: boolean;
}) => {
  const total = day.events.length;

  return (
    <section
      className={clsx(styles.day, isHighlighted && styles.dayHighlighted)}
      id={day.date}
    >
      <div className={styles.dayHeader}>
        <h2 className={styles.dayDate}>{fmtDateLong(day.date)}</h2>
        <span className={styles.dayLabel}>{day.label.toLowerCase()}</span>
        <div className={styles.dayHeaderActions}>
          {total > 0 && (
            <span className={styles.dayCount}>
              {total} change{total === 1 ? "" : "s"}
            </span>
          )}
          <CopyLinkButton date={day.date} />
        </div>
      </div>

      {total === 0 ? (
        <div className={styles.dayEmpty}>No status transitions today.</div>
      ) : (
        <>
          <p className={styles.dayHero}>{day.hero}</p>

          <div className={styles.eventsList}>
            {day.events.map((e) => (
              <EventRow entry={e} key={`${e.id}-${e.changeType}`} />
            ))}
          </div>
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

// ─── Stream view ─────────────────────────────────────────────────────────

type FilterKey = "all" | ChangeType;

const FILTERS: { key: FilterKey; label: string; type: ChangeType | null }[] = [
  { key: "all", label: "All", type: null },
  { key: "added", label: "Added", type: "added" },
  { key: "went_live", label: "Went live", type: "went_live" },
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
        <span aria-hidden className={styles.updatedDot} />
        Updated {fmtDateShort(lastUpdated)} UTC
      </span>
    )}
  </div>
);

const ModeToggle = ({
  mode,
  setMode,
}: {
  mode: Mode;
  setMode: (m: Mode) => void;
}) => (
  <div aria-label="View mode" className={styles.modeToggle} role="tablist">
    {(["day", "stream"] as const).map((m) => (
      <button
        aria-selected={mode === m}
        className={clsx(
          styles.modeToggleButton,
          mode === m && styles.modeToggleButtonActive,
        )}
        key={m}
        onClick={() => {
          setMode(m);
        }}
        role="tab"
        type="button"
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
  Failed: (error: unknown) => ({ error, type: StateType.Error as const }),
  Loaded: (log: ChangeLogData) => ({
    log,
    type: StateType.Loaded as const,
  }),
  Loading: () => ({ type: StateType.Loading as const }),
  NotLoaded: () => ({ type: StateType.NotLoaded as const }),
};
type State = ReturnType<(typeof State)[keyof typeof State]>;

const errorToString = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "An error occurred while loading the change log.";
};
