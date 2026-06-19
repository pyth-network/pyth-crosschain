import clsx from "clsx";
import type { DaySummary, WeekRollup } from "./data";
import { fmtDateShort } from "./data";
import styles from "./index.module.scss";

type StatKey = keyof DaySummary;

const STATS: { key: StatKey; label: string; modifier: string }[] = [
  { key: "added", label: "added", modifier: "added" },
  { key: "went_live", label: "went live", modifier: "wentLive" },
  { key: "removed", label: "removed", modifier: "removed" },
];

const sumTotals = (t: DaySummary) => t.added + t.went_live + t.removed;

export const WeekSummary = ({ rollup }: { rollup: WeekRollup }) => {
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
