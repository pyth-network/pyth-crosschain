"use client";

import { CopyButton } from "@pythnetwork/component-library/CopyButton";

function mapValues<T, U>(
  obj: Record<string, T> | Partial<Record<string, T>>,
  fn: (value: T, key: string) => U
): Record<string, U> {
  const result: Record<string, U> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key] = fn(value, key);
    }
  }
  return result;
}

// SponsoredFeed interface has the same structure as defined in deployment yaml/json files
type SponsoredFeed = {
  alias: string; // name of the feed
  account_address?: string; // optional, needed only for solana.
  id: string; // price feed id
  time_difference: number; // in seconds
  price_deviation: number;
  confidence_ratio: number;
}

type SponsoredFeedsTableProps = {
  feeds: SponsoredFeed[];
  networkName: string;
}

type UpdateParamsProps = {
  feed: SponsoredFeed;
  isDefault: boolean;
}

/**
 * Helper functions
 */
// Convert time_difference (seconds) to human readable format
const formatTimeUnit = (seconds: number): { value: number; unit: string } => {
  // @ts-expect-error - Intl.DurationFormat is not a standard type (experimental API)
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
  const duration = new Intl.DurationFormat("en", {
    style: "long",
    numeric: "auto",
  });

  const durationObj = 
    seconds >= 3600
      ? { hours: Math.floor(seconds / 3600) }
      : (seconds >= 60
        ? { minutes: Math.floor(seconds / 60) }
        : { seconds });

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  const parts = duration.formatToParts(durationObj);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  const intPart = parts.find(
    (p: { type: string; value: string; unit: string }) => p.type === "integer",
  );
  
  return intPart
    ? // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
      { value: Number(intPart.value), unit: intPart.unit }
    : { value: seconds, unit: "second" };
};

// Format update parameters as a string for grouping
const formatUpdateParams = (feed: SponsoredFeed): string => {
  const timeFormat = formatTimeUnit(feed.time_difference);
  const timeStr = `${String(timeFormat.value)} ${timeFormat.unit}${
    timeFormat.value === 1 ? "" : "s"
  }`;
  return `${timeStr} heartbeat / ${String(feed.price_deviation)}% price deviation`;
};

const UpdateParams = ({ feed, isDefault }: UpdateParamsProps) => {
  const timeFormat = formatTimeUnit(feed.time_difference);
  const timeStr =
    timeFormat.value === 1 ? timeFormat.unit : `${timeFormat.unit}s`;

  return (
    <div className="flex items-start gap-1.5">
      <div
        className={`w-1.5 h-1.5 rounded-full mt-1 flex-shrink-0 ${
          isDefault ? "bg-green-500" : "bg-orange-500"
        }`}
      ></div>
      <span
        className={`text-xs leading-relaxed font-medium ${
          isDefault
            ? "text-gray-700 dark:text-gray-300"
            : "text-orange-600 dark:text-orange-400"
        }`}
      >
        <strong>{timeFormat.value}</strong> {timeStr} heartbeat
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
  // Handle empty feeds
  if (feeds.length === 0) {
    return (
      <div className="my-6">
        <p className="mb-3">
          No sponsored price feeds are currently available for{" "}
          <strong>{networkName}</strong>.
        </p>
      </div>
    );
  }

  // Calculate parameter statistics
  const paramCounts = mapValues(
    Object.groupBy(feeds, (feed) => formatUpdateParams(feed)),
    (feeds: SponsoredFeed[]) => feeds.length
  );

  const paramEntries = Object.entries(paramCounts).sort(
    ([, a], [, b]) => b - a
  );
  const defaultParams = paramEntries.length > 0 ? paramEntries[0][0] : "";

  const hasAccountAddress = feeds.some((feed) => !!feed.account_address);

  return (
    <div className="my-6">
      <p className="mb-3">
        The price feeds listed in the table below are currently sponsored in{" "}
        <strong>{networkName}</strong>.
      </p>

      <div className="border border-gray-200 dark:border-gray-700 rounded-lg">
        {/* Summary bar */}
        <div className="bg-blue-50 dark:bg-blue-900/20 px-3 py-2 border-b border-gray-200 dark:border-gray-600">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full flex-shrink-0"></div>
              <span className="font-medium">Default:</span>
              <span>{defaultParams}</span>
              <span className="text-gray-500">
                ({paramCounts[defaultParams]})
              </span>
            </div>
            {Object.entries(paramCounts)
              .filter(([params]) => params !== defaultParams)
              .map(([params, count]) => (
                <div key={params} className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 bg-orange-500 rounded-full flex-shrink-0"></div>
                  <span className="font-medium">Exception:</span>
                  <span>{params}</span>
                  <span className="text-gray-500">({count})</span>
                </div>
              ))}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <div className="overflow-y-auto max-h-96">
            <table className="w-full text-sm min-w-full">
              <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800 z-30">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-600 min-w-[100px]">
                    Name
                  </th>
                  {hasAccountAddress && (
                    <th className="text-left px-3 py-2 font-semibold text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-600 min-w-[400px]">
                      Account Address
                    </th>
                  )}
                  <th className="text-left px-3 py-2 font-semibold text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-600 min-w-[400px]">
                    Price Feed Id
                  </th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-600 min-w-[200px]">
                    Update Parameters
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900">
                {feeds.map((feed) => {
                  const formattedParams = formatUpdateParams(feed);
                  const isDefault = formattedParams === defaultParams;

                  return (
                    <tr
                      key={feed.id}
                      className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/30"
                    >
                      <td className="px-3 py-2 align-top">
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {feed.alias}
                        </span>
                      </td>
                      {hasAccountAddress && (
                        <td className="px-3 py-2 align-top">
                          {feed.account_address ? (
                            <div className="flex items-start gap-2">
                              <code className="text-xs font-mono text-gray-600 dark:text-gray-400 break-all leading-relaxed">
                                {feed.account_address}
                              </code>
                              <CopyButton
                                text={feed.account_address}
                                iconOnly
                              />
                            </div>
                          ) : undefined}
                        </td>
                      )}
                      <td className="px-3 py-2 align-top">
                        <div className="flex items-start gap-2">
                          <code className="text-xs font-mono text-gray-600 dark:text-gray-400 flex-1 break-all leading-relaxed">
                            {feed.id}
                          </code>
                          <CopyButton text={feed.id} iconOnly />
                        </div>
                      </td>
                      <td className="px-3 py-2 align-top">
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
    </div>
  );
};
