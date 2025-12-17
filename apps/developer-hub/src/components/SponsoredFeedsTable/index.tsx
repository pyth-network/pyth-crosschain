import { CopyButton } from "@pythnetwork/component-library/CopyButton";
import { Table } from "@pythnetwork/component-library/Table";
import clsx from "clsx";
import type { ReactNode } from "react";
import { useMemo } from "react";

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

const truncateHex = (value: string) =>
  `${value.slice(0, 6)}...${value.slice(-4)}`;

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

  const columns = useMemo(
    () => [
      {
        id: "name",
        name: "Name",
        isRowHeader: true,
        alignment: "left" as const,
      },
      ...(hasAccountAddress
        ? [
            {
              id: "accountAddress",
              name: "Account Address",
              alignment: "left" as const,
            },
          ]
        : []),
      {
        id: "priceFeedId",
        name: "Price Feed Id",
        alignment: "left" as const,
      },
      {
        id: "updateParameters",
        name: "Update Parameters",
        alignment: "left" as const,
      },
    ],
    [hasAccountAddress],
  );

  const rows = useMemo(
    () =>
      feeds.map((feed) => {
        const formattedParams = formatUpdateParams(feed);
        const isDefault = formattedParams === defaultParams;

        const rowData: {
          name: ReactNode;
          priceFeedId: ReactNode;
          updateParameters: ReactNode;
          accountAddress: ReactNode | undefined;
        } = {
          name: <span className={styles.nameLabel}>{feed.alias}</span>,
          priceFeedId: (
            <CopyButton text={feed.id}>{truncateHex(feed.id)}</CopyButton>
          ),
          updateParameters: <UpdateParams feed={feed} isDefault={isDefault} />,
          accountAddress: undefined,
        };

        if (hasAccountAddress) {
          rowData.accountAddress = feed.account_address ? (
            <CopyButton text={feed.account_address}>
              {truncateHex(feed.account_address)}
            </CopyButton>
          ) : undefined;
        }

        return {
          id: feed.id,
          data: rowData,
        };
      }),
    [feeds, defaultParams, hasAccountAddress],
  );

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

        <Table
          label="Sponsored Feeds"
          fill
          columns={columns}
          rows={rows}
          stickyHeader="top"
          className={clsx("not-prose", styles.table)}
        />
      </div>
    </div>
  );
};

export default SponsoredFeedsTable;
