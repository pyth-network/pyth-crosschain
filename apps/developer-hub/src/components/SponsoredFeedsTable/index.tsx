import { CopyButton } from "@pythnetwork/component-library/CopyButton";
import clsx from "clsx";

import styles from "./index.module.scss";

type SponsoredFeed = {
  alias: string;
  account_address?: string;
  id: string;
  time_difference: number;
  price_deviation: number;
  confidence_ratio: number;
};

type SponsoredFeedsTableProps = {
  feeds: SponsoredFeed[];
  networkName: string;
};

type UpdateParamsProps = {
  feed: SponsoredFeed;
  isDefault: boolean;
};

const formatTimeDifference = (
  seconds: number,
): { value: number; unit: string } => {
  if (seconds >= 3600) {
    const hours = Math.floor(seconds / 3600);
    return { value: hours, unit: hours === 1 ? "hour" : "hours" };
  }

  if (seconds >= 60) {
    const minutes = Math.floor(seconds / 60);
    return { value: minutes, unit: minutes === 1 ? "minute" : "minutes" };
  }

  return { value: seconds, unit: seconds === 1 ? "second" : "seconds" };
};

const formatUpdateParams = (feed: SponsoredFeed): string => {
  const timeFormat = formatTimeDifference(feed.time_difference);
  const timeLabel = `${timeFormat.value.toString()} ${timeFormat.unit}`;
  return `${timeLabel} heartbeat / ${feed.price_deviation.toString()}% price deviation`;
};

const UpdateParams = ({ feed, isDefault }: UpdateParamsProps) => {
  const timeFormat = formatTimeDifference(feed.time_difference);
  const timeLabel =
    timeFormat.value === 1
      ? timeFormat.unit.replace(/s$/, "")
      : `${timeFormat.unit.replace(/s$/, "")}s`;

  return (
    <div
      className={clsx(
        styles.updateParams,
        isDefault ? styles.updateParamsDefault : styles.updateParamsException,
      )}
    >
      <div
        className={clsx(
          styles.statusDot,
          isDefault ? styles.statusDotDefault : styles.statusDotException,
        )}
      />
      <span className={styles.updateParamsText}>
        <strong>{timeFormat.value}</strong> {timeLabel} heartbeat
        <br />
        <strong>{feed.price_deviation}%</strong> price deviation
      </span>
    </div>
  );
};

export const SponsoredFeedsTable = ({
  feeds,
  networkName,
}: SponsoredFeedsTableProps) => {
  if (feeds.length === 0) {
    return (
      <div className={styles.container}>
        <p className={styles.introText}>
          No sponsored price feeds are currently available for{" "}
          <strong>{networkName}</strong>.
        </p>
      </div>
    );
  }

  const paramCounts: Record<string, number> = {};
  for (const feed of feeds) {
    const key = formatUpdateParams(feed);
    const current = paramCounts[key] ?? 0;
    paramCounts[key] = current + 1;
  }

  const paramEntries = Object.entries(paramCounts).sort(
    (entryA, entryB) => entryB[1] - entryA[1],
  );
  const defaultParams = paramEntries[0]?.[0];
  const defaultCount =
    defaultParams === undefined ? 0 : (paramCounts[defaultParams] ?? 0);

  const hasAccountAddress = feeds.some((feed) => !!feed.account_address);

  return (
    <div className={styles.container}>
      <p className={styles.introText}>
        The price feeds listed below are currently sponsored in{" "}
        <strong>{networkName}</strong>.
      </p>
      <div className={styles.tableWrapper}>
        <div className={styles.summaryBar}>
          {defaultParams ? (
            <div className={styles.summaryItem}>
              <span
                className={clsx(styles.statusDot, styles.statusDotDefault)}
              />
              <span className={styles.summaryLabel}>Default:</span>
              <span>{defaultParams}</span>
              <span className={styles.summaryCount}>({defaultCount})</span>
            </div>
          ) : undefined}
          {paramEntries
            .filter(([params]) => params !== defaultParams)
            .map(([params, count]) => (
              <div key={params} className={styles.summaryItem}>
                <span
                  className={clsx(styles.statusDot, styles.statusDotException)}
                />
                <span className={styles.summaryLabel}>Exception:</span>
                <span>{params}</span>
                <span className={styles.summaryCount}>({count})</span>
              </div>
            ))}
        </div>

        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead className={styles.tableHead}>
              <tr>
                <th className={styles.headerCell}>Name</th>
                {hasAccountAddress ? (
                  <th className={styles.headerCell}>Account Address</th>
                ) : undefined}
                <th className={styles.headerCell}>Price Feed Id</th>
                <th className={styles.headerCell}>Update Parameters</th>
              </tr>
            </thead>
            <tbody className={styles.tableBody}>
              {feeds.map((feed) => {
                const formattedParams = formatUpdateParams(feed);
                const isDefault = formattedParams === defaultParams;

                return (
                  <tr key={feed.id} className={styles.tableRow}>
                    <td className={styles.nameCell}>
                      <span className={styles.nameLabel}>{feed.alias}</span>
                    </td>
                    {hasAccountAddress ? (
                      <td className={styles.accountCell}>
                        {feed.account_address ? (
                          <div className={styles.copyWrapper}>
                            <code className={styles.code}>
                              {feed.account_address}
                            </code>
                            <CopyButton text={feed.account_address} iconOnly />
                          </div>
                        ) : undefined}
                      </td>
                    ) : undefined}
                    <td className={styles.idCell}>
                      <div className={styles.copyWrapper}>
                        <code className={styles.code}>{feed.id}</code>
                        <CopyButton text={feed.id} iconOnly />
                      </div>
                    </td>
                    <td className={styles.paramsCell}>
                      <UpdateParams feed={feed} isDefault={isDefault} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SponsoredFeedsTable;
