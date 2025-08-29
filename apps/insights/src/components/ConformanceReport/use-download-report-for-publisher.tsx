import { stringify as stringifyCsv } from "csv-stringify/sync";
import {
  addDays,
  differenceInDays,
  format,
  isBefore,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { useCallback } from "react";
import { parse } from "superjson";
import { z } from "zod";

import { WEB_API_BASE_URL } from "./constants";
import type { Interval } from "./types";
import { useDownloadBlob } from "../../hooks/use-download-blob";
import { priceFeedsSchema } from "../../schemas/pyth/price-feeds-schema";
import { CLUSTER_NAMES } from "../../services/pyth";

// If interval is 'daily', set interval_days=1
// If interval is 'weekly', get the previous Sunday and set interval_days=7
// If interval is 'monthly', get the 15th of the current month and set interval_day to the
// difference between the 15th of the current month and the 15th of the previous month which is 28-31 days.
const getRankingDateAndIntervalDays = (date: Date, interval: Interval) => {
  switch (interval) {
    case "24H": {
      return {
        date,
        intervalDays: 1,
      };
    }
    case "48H": {
      return {
        date,
        intervalDays: 2,
      };
    }
    case "72H": {
      return {
        date,
        intervalDays: 3,
      };
    }
    case "1W": {
      return {
        date: startOfWeek(date),
        intervalDays: 7,
      };
    }
    case "1M": {
      const monthStart = startOfMonth(date);
      let midMonth = addDays(monthStart, 14);
      if (isBefore(date, midMonth)) {
        midMonth = subMonths(midMonth, 1);
      }
      const midMonthBefore = subMonths(midMonth, 1);
      return {
        date: midMonth,
        intervalDays: differenceInDays(midMonth, midMonthBefore),
      };
    }
  }
};

const getFeeds = async (cluster: (typeof CLUSTER_NAMES)[number]) => {
  const url = new URL(`/api/pyth/get-feeds`, globalThis.window.origin);
  url.searchParams.set("cluster", cluster);
  const data = await fetch(url);
  const rawData = await data.text();
  const parsedData = parse(rawData);
  return priceFeedsSchema.element.array().parse(parsedData);
};

const publisherQualityScoreSchema = z.object({
  symbol: z.string(),
  uptime_score: z.string(),
  deviation_penalty: z.string(),
  deviation_score: z.string(),
  stalled_penalty: z.string(),
  stalled_score: z.string(),
  final_score: z.string(),
});

const publisherQuantityScoreSchema = z.object({
  numSymbols: z.number(),
  rank: z.number(),
  symbols: z.array(z.string()),
  timestamp: z.string(),
});

const fetchRankingData = async (
  cluster: (typeof CLUSTER_NAMES)[number],
  publisher: string,
  interval: Interval,
) => {
  const { date, intervalDays } = getRankingDateAndIntervalDays(
    new Date(),
    interval,
  );
  const quantityRankUrl = new URL(`/publisher_ranking`, WEB_API_BASE_URL);
  quantityRankUrl.searchParams.set("cluster", cluster);
  quantityRankUrl.searchParams.set("publisher", publisher);
  const qualityRankUrl = new URL(
    `/publisher_quality_ranking_score`,
    WEB_API_BASE_URL,
  );
  qualityRankUrl.searchParams.set("cluster", cluster);
  qualityRankUrl.searchParams.set("publisher", publisher);
  qualityRankUrl.searchParams.set("date", format(date, "yyyy-MM-dd"));
  qualityRankUrl.searchParams.set("interval_days", intervalDays.toString());

  const [quantityRankRes, qualityRankRes] = await Promise.all([
    fetch(quantityRankUrl),
    fetch(qualityRankUrl),
  ]);

  return {
    quantityRankData: publisherQuantityScoreSchema
      .array()
      .parse(await quantityRankRes.json()),
    qualityRankData: publisherQualityScoreSchema
      .array()
      .parse(await qualityRankRes.json()),
  };
};
const csvHeaders = [
  "priceFeed",
  "assetType",
  "description",
  "status",
  "permissioned",
  "uptime_score",
  "deviation_penalty",
  "deviation_score",
  "stalled_penalty",
  "stalled_score",
  "final_score",
];

const symbolsSort = (a: string, b: string) => {
  const aSplit = a.split(".");
  const bSplit = b.split(".");
  const aLast = aSplit.at(-1);
  const bLast = bSplit.at(-1);
  return aLast?.localeCompare(bLast ?? "") ?? 0;
};

export const useDownloadReportForPublisher = () => {
  const download = useDownloadBlob();

  return useCallback(
    async ({
      publisher,
      cluster,
      interval,
    }: {
      publisher: string;
      cluster: (typeof CLUSTER_NAMES)[number];
      interval: Interval;
    }) => {
      const [rankingData, allFeeds] = await Promise.all([
        fetchRankingData(cluster, publisher, interval),
        getFeeds(cluster),
      ]);

      const isPermissioned = (feed: string) =>
        allFeeds
          .find((f) => f.symbol === feed)
          ?.price.priceComponents.some((c) => c.publisher === publisher);

      const getPriceFeedData = (feed: string) => {
        const rankData = rankingData.qualityRankData.find(
          (obj) => obj.symbol === feed,
        );
        const feedMetadata = allFeeds.find((f) => f.symbol === feed);
        return {
          priceFeed: feedMetadata?.product.display_symbol ?? "",
          assetType: feedMetadata?.product.asset_type ?? "",
          description: feedMetadata?.product.description ?? "",
          ...rankData,
        };
      };

      const activePriceFeeds =
        rankingData.quantityRankData[0]?.symbols.sort(symbolsSort) ?? [];

      const allSymbols = allFeeds
        .map((feed) => feed.symbol)
        .filter((symbol: string) => symbol && !symbol.includes("NULL"));

      // filter out inactive price feeds
      const inactivePriceFeeds = allSymbols
        .filter((symbol) => {
          const meta = allFeeds.find((f) => f.symbol === symbol);
          return (
            meta !== undefined &&
            !activePriceFeeds.includes(symbol) &&
            meta.price.numComponentPrices > 0
          );
        })
        .sort(symbolsSort);

      const data = [
        ...activePriceFeeds.map((feed) => ({
          ...getPriceFeedData(feed),
          status: "active",
          permissioned: "permissioned",
        })),
        ...inactivePriceFeeds.map((feed) => ({
          ...getPriceFeedData(feed),
          status: "inactive",
          permissioned: isPermissioned(feed)
            ? "permissioned"
            : "unpermissioned",
        })),
      ];

      const csv = stringifyCsv(data, { header: true, columns: csvHeaders });
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      download(blob, `${publisher}-${cluster}-price-feeds.csv`);
    },
    [download],
  );
};
