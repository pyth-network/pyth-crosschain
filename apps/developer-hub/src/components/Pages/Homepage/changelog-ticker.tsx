import Link from "next/link";

import type { ChangeType } from "../../ChangeLog/data";
import { getChangeLog } from "../../ChangeLog/data";
import styles from "./changelog-ticker.module.scss";

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

// How many of the most recent events to scroll through.
const MAX_ITEMS = 18;

export const ChangelogTicker = () => {
  const { days } = getChangeLog();

  // `days` is ordered oldest-first; reverse so the newest changes lead.
  const items = [...days]
    .reverse()
    .flatMap((day) => day.events)
    .slice(0, MAX_ITEMS);

  if (items.length === 0) {
    return null;
  }

  // The track is rendered twice so the marquee can loop seamlessly. The second
  // copy is purely decorative, so it is hidden from assistive technology.
  const renderItems = (duplicate: boolean) =>
    items.map((entry, index) => (
      <span
        aria-hidden={duplicate || undefined}
        className={styles.item}
        key={`${duplicate ? "dup" : "src"}-${entry.id}-${index.toString()}`}
      >
        <span
          className={`${styles.dot} ${DOT_CLASS[entry.changeType] ?? ""}`}
        />
        <span className={styles.itemId}>{entry.id}</span>
        <span className={styles.itemLabel}>
          {CHANGE_LABELS[entry.changeType]}
        </span>
      </span>
    ));

  return (
    <div className={styles.ticker}>
      <Link
        aria-label="Latest price feed changes. View the full change log."
        className={styles.link}
        href="/price-feeds/changelog"
      >
        <span className={styles.tag}>Feed updates</span>
        <div className={styles.viewport}>
          <div className={styles.track}>
            {renderItems(false)}
            {renderItems(true)}
          </div>
        </div>
        <span className={styles.cta}>View all</span>
      </Link>
    </div>
  );
};
