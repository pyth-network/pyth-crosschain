"use client";

import { useEffect, useState } from "react";
import { DayView } from "./DayView";
import type { ChangeLog as ChangeLogData } from "./data";
import styles from "./index.module.scss";
import { MetaBar } from "./MetaBar";
import { StreamView } from "./StreamView";
import type { Mode } from "./types";
import { WeekSummary } from "./WeekSummary";

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

export const ChangeLogView = ({ log }: { log: ChangeLogData }) => {
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
