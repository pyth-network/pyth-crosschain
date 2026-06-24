"use client";

import Link from "next/link";
import { useCallback, useLayoutEffect, useRef, useState } from "react";

import type { ChangeType } from "../ChangeLog/data";
import styles from "./index.module.scss";

export type ChangelogBarItem = {
  id: string;
  changeType: ChangeType;
};

const CHANGE_LABELS: Record<ChangeType, string> = {
  added: "added",
  removed: "removed",
  went_live: "went live",
};

const DOT_CLASS: Record<ChangeType, string | undefined> = {
  added: styles.dotAdded,
  removed: styles.dotRemoved,
  went_live: styles.dotWentLive,
};

const renderItem = (item: ChangelogBarItem, index: number) => (
  <span className={styles.item} key={`${item.id}-${index.toString()}`}>
    <span className={`${styles.dot} ${DOT_CLASS[item.changeType] ?? ""}`} />
    <span className={styles.itemId}>{item.id}</span>
    <span className={styles.itemLabel}>{CHANGE_LABELS[item.changeType]}</span>
  </span>
);

export const ChangelogBarRow = ({ items }: { items: ChangelogBarItem[] }) => {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const measureRef = useRef<HTMLDivElement | null>(null);
  // Assume everything fits until the layout effect measures and trims to fit.
  const [visibleCount, setVisibleCount] = useState(items.length);

  const measure = useCallback(() => {
    const viewport = viewportRef.current;
    const measureRow = measureRef.current;
    if (!viewport || !measureRow) {
      return;
    }

    // The off-screen measurement row always holds every item, so its children
    // give stable geometry no matter how many the visible row is showing.
    const available = viewport.clientWidth;
    let count = 0;
    for (const el of Array.from(measureRow.children) as HTMLElement[]) {
      if (el.offsetLeft + el.offsetWidth > available) {
        break;
      }
      count += 1;
    }

    // Always show at least one item, even if it has to clip on a narrow screen.
    setVisibleCount(Math.max(1, count));
  }, []);

  useLayoutEffect(() => {
    measure();

    // Monospace IDs can change width when the web font swaps in, which never
    // resizes the viewport — re-measure once fonts settle so the count stays
    // accurate.
    if ("fonts" in document) {
      void document.fonts.ready.then(measure);
    }

    const viewport = viewportRef.current;
    if (!viewport || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    return () => {
      observer.disconnect();
    };
  }, [measure]);

  const hiddenCount = items.length - visibleCount;

  return (
    <div className={styles.bar}>
      <Link className={styles.link} href="/price-feeds/changelog">
        <span className={styles.tag}>Feed updates</span>
        <div className={styles.viewport} ref={viewportRef}>
          {/* Off-screen copy holding every item, used only to measure how many
              fit on one line. Hidden from assistive tech and pointer events. */}
          <div
            aria-hidden
            className={`${styles.row} ${styles.measure}`}
            ref={measureRef}
          >
            {items.map(renderItem)}
          </div>
          <div className={styles.row}>
            {items.slice(0, visibleCount).map(renderItem)}
          </div>
        </div>
        <span className={styles.more}>
          {hiddenCount > 0 ? `+${hiddenCount.toString()} more` : "View all"}
        </span>
      </Link>
    </div>
  );
};
