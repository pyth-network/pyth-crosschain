import { Badge } from "@pythnetwork/component-library/Badge";
import { CopyButton } from "@pythnetwork/component-library/CopyButton";
import { Table } from "@pythnetwork/component-library/Table";
import {
  getPriceFeedAccountForProgram,
  PRO_COMPATIBLE_PUSH_ORACLE_PROGRAM_ID,
} from "@pythnetwork/pyth-solana-receiver";
import clsx from "clsx";
import type { ReactNode } from "react";
import { useMemo } from "react";

import styles from "./index.module.scss";

// The Pyth Core upgrade guide explains what "Pro-compatible" means for a feed.
// The column header and intro copy link here rather than to the raw API spec.
const PRO_COMPATIBLE_DOCS_URL = "/price-feeds/core/upgrade/preparing";

/**
 * `pro_compatible_status` is a DERIVED, point-in-time field on the push-feed
 * data files (content/docs/price-feeds/core/push-feeds/data/{evm,sui,svm}/*.json).
 * It is not returned by any API; it is computed and committed into the JSON:
 *
 *   1. Fetch the Pro-compatible Hermes listing:
 *      GET https://pyth.dourolabs.app/hermes/v2/price_feeds
 *   2. For each feed, set "available" if its `id` is present in that listing,
 *      otherwise "coming_soon".
 *   3. Avalanche carve-out: every Avalanche feed is pinned to "coming_soon"
 *      regardless of the listing, because Pro-compatible push feeds are not
 *      deployed for that chain (no deployment-pro-compatible.yaml). See the
 *      `_comment` in data/evm/avalanche-mainnet.json.
 *
 * Last refreshed 2026-06-23. To refresh, re-run the steps above.
 */
type ProCompatibleStatus = "available" | "coming_soon";

type SponsoredFeed = {
  alias: string;
  account_address?: string;
  id: string;
  time_difference: number;
  price_deviation: number;
  confidence_ratio: number;
  pro_compatible_status?: ProCompatibleStatus;
};

type SponsoredFeedsTableProps = {
  feeds: SponsoredFeed[];
  networkName: string;
  showUpgradedAccountAddress?: boolean;
  hideAccountAddress?: boolean;
  showProCompatibleStatus?: boolean;
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

const ProCompatibleStatusBadge = ({
  status,
}: {
  status: ProCompatibleStatus;
}) =>
  status === "available" ? (
    <Badge variant="success" size="xs" style="filled">
      Available
    </Badge>
  ) : (
    <Badge variant="warning" size="xs" style="filled">
      Coming soon
    </Badge>
  );

export const SponsoredFeedsTable = ({
  feeds,
  networkName,
  showUpgradedAccountAddress = false,
  hideAccountAddress = false,
  showProCompatibleStatus = false,
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

  const hasAccountAddress =
    !hideAccountAddress && feeds.some((feed) => !!feed.account_address);

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
      ...(showUpgradedAccountAddress
        ? [
            {
              id: "upgradedAccountAddress",
              name: "Upgraded Account Address",
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
      ...(showProCompatibleStatus
        ? [
            {
              id: "proCompatibleStatus",
              name: (
                <a
                  href={PRO_COMPATIBLE_DOCS_URL}
                  className={styles.proCompatibleHeaderLink}
                >
                  Pro-compatible
                </a>
              ),
              alignment: "left" as const,
            },
          ]
        : []),
    ],
    [hasAccountAddress, showUpgradedAccountAddress, showProCompatibleStatus],
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
          upgradedAccountAddress: ReactNode | undefined;
          proCompatibleStatus: ReactNode | undefined;
        } = {
          name: <span className={styles.nameLabel}>{feed.alias}</span>,
          priceFeedId: (
            <CopyButton text={feed.id}>{truncateHex(feed.id)}</CopyButton>
          ),
          updateParameters: <UpdateParams feed={feed} isDefault={isDefault} />,
          accountAddress: undefined,
          upgradedAccountAddress: undefined,
          proCompatibleStatus: undefined,
        };

        if (hasAccountAddress) {
          rowData.accountAddress = feed.account_address ? (
            <CopyButton text={feed.account_address}>
              {truncateHex(feed.account_address)}
            </CopyButton>
          ) : undefined;
        }

        if (showUpgradedAccountAddress) {
          const upgradedAddress = getPriceFeedAccountForProgram(
            0,
            feed.id,
            PRO_COMPATIBLE_PUSH_ORACLE_PROGRAM_ID,
          ).toBase58();
          rowData.upgradedAccountAddress = (
            <CopyButton text={upgradedAddress}>
              {truncateHex(upgradedAddress)}
            </CopyButton>
          );
        }

        if (showProCompatibleStatus) {
          rowData.proCompatibleStatus = (
            <ProCompatibleStatusBadge
              status={feed.pro_compatible_status ?? "coming_soon"}
            />
          );
        }

        return {
          id: feed.id,
          data: rowData,
        };
      }),
    [
      feeds,
      defaultParams,
      hasAccountAddress,
      showUpgradedAccountAddress,
      showProCompatibleStatus,
    ],
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
      {showProCompatibleStatus && (
        <p className={styles.introText}>
          The <strong>Pro-compatible</strong> column shows whether each feed is
          already served by the upgraded Hermes endpoint for the{" "}
          <a href={PRO_COMPATIBLE_DOCS_URL}>Pyth Core upgrade</a>. Feeds marked{" "}
          <strong>Available</strong> are already served by the upgraded Hermes;{" "}
          <strong>Coming soon</strong> feeds are still being migrated.
        </p>
      )}
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
