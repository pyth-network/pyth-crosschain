import clsx from "clsx";

import { CopyLinkButton } from "./CopyLinkButton";
import type { Day } from "./data";
import { fmtDateLong } from "./data";
import { EventRow } from "./EventRow";
import styles from "./index.module.scss";

export const DayView = ({
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
