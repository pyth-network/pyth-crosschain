import clsx from "clsx";
import type { ChangeLogEntry, ChangeType } from "./data";
import { fmtDateShort, terminalUrl } from "./data";
import styles from "./index.module.scss";

const CHANGE_LABELS: Record<ChangeType, string> = {
  added: "added",
  removed: "removed",
  went_live: "went live",
};

export const dotClassFor = (type: ChangeType): string | undefined => {
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

export const EventRow = ({
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
      <a
        className={styles.eventId}
        href={terminalUrl(entry.id)}
        rel="noopener noreferrer"
        target="_blank"
      >
        {entry.id}
      </a>
      <span className={styles.eventAsset}>{entry.asset}</span>
      <span className={styles.eventAssetType}>· {entry.assetType}</span>
    </div>
  </div>
);
