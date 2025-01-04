import "server-only";

import { createClient } from "@clickhouse/client";
import { z, type ZodSchema, type ZodTypeDef } from "zod";

import { Cluster, ClusterToName } from "./pyth";
import { cache } from "../cache";
import { CLICKHOUSE } from "../config/server";

const client = createClient(CLICKHOUSE);

const ONE_MINUTE_IN_SECONDS = 60;
const ONE_HOUR_IN_SECONDS = 60 * ONE_MINUTE_IN_SECONDS;

export const getPublishers = cache(
  async () =>
    safeQuery(
      z.array(
        z.strictObject({
          key: z.string(),
          rank: z.number(),
          numSymbols: z.number(),
          medianScore: z.number(),
        }),
      ),
      {
        query: `
          SELECT key, rank, numSymbols, medianScore
          FROM insights_publishers(cluster={cluster: String})
        `,
        query_params: { cluster: "pythnet" },
      },
    ),
  ["publishers"],
  {
    revalidate: ONE_HOUR_IN_SECONDS,
  },
);

export const getRankingsByPublisher = cache(
  async (publisherKey: string) =>
    safeQuery(rankingsSchema, {
      query: `
          SELECT * FROM insights__rankings
          WHERE publisher = {publisherKey: String}
        `,
      query_params: { publisherKey },
    }),
  ["rankingsByPublisher"],
  {
    revalidate: ONE_HOUR_IN_SECONDS,
  },
);

export const getRankingsBySymbol = cache(
  async (symbol: string) =>
    safeQuery(rankingsSchema, {
      query: `
          SELECT * FROM insights__rankings
          WHERE symbol = {symbol: String}
        `,
      query_params: { symbol },
    }),
  ["rankingsBySymbol"],
  {
    revalidate: ONE_HOUR_IN_SECONDS,
  },
);

const rankingsSchema = z.array(
  z.strictObject({
    symbol: z.string(),
    cluster: z.enum(["pythnet", "pythtest-conformance"]),
    publisher: z.string(),
    uptime_score: z.number(),
    uptime_rank: z.number(),
    deviation_penalty: z.number().nullable(),
    deviation_score: z.number(),
    deviation_rank: z.number(),
    stalled_penalty: z.number(),
    stalled_score: z.number(),
    stalled_rank: z.number(),
    final_score: z.number(),
    final_rank: z.number(),
    is_active: z.number().transform((value) => value === 1),
  }),
);

export const getYesterdaysPrices = cache(
  async (symbols: string[]) =>
    safeQuery(
      z.array(
        z.object({
          symbol: z.string(),
          price: z.number(),
        }),
      ),
      {
        query: `
          SELECT symbol, price
          FROM insights_yesterdays_prices(symbols={symbols: Array(String)})
        `,
        query_params: { symbols },
      },
    ),
  ["yesterdays-prices"],
  {
    revalidate: ONE_HOUR_IN_SECONDS,
  },
);

export const getPublisherRankingHistory = cache(
  async (key: string) =>
    safeQuery(
      z.array(
        z.strictObject({
          timestamp: z.string().transform((value) => new Date(value)),
          rank: z.number(),
        }),
      ),
      {
        query: `
          SELECT * FROM (
            SELECT timestamp, rank
            FROM publishers_ranking
            WHERE publisher = {key: String}
            AND cluster = 'pythnet'
            ORDER BY timestamp DESC
            LIMIT 30
          )
          ORDER BY timestamp ASC
        `,
        query_params: { key },
      },
    ),
  ["publisher-ranking-history"],
  { revalidate: ONE_HOUR_IN_SECONDS },
);

export const getFeedScoreHistory = cache(
  async (cluster: Cluster, publisherKey: string, symbol: string) =>
    safeQuery(
      z.array(
        z.strictObject({
          time: z.string().transform((value) => new Date(value)),
          score: z.number(),
          uptimeScore: z.number(),
          deviationScore: z.number(),
          stalledScore: z.number(),
        }),
      ),
      {
        query: `
          SELECT * FROM (
            SELECT
              time,
              final_score AS score,
              uptime_score AS uptimeScore,
              deviation_score AS deviationScore,
              stalled_score AS stalledScore
            FROM default.publisher_quality_ranking
            WHERE publisher = {publisherKey: String}
            AND cluster = {cluster: String}
            AND symbol = {symbol: String}
            ORDER BY time DESC
            LIMIT 30
          )
          ORDER BY time ASC
        `,
        query_params: {
          cluster: ClusterToName[cluster],
          publisherKey,
          symbol,
        },
      },
    ),
  ["feed-score-history"],
  {
    revalidate: ONE_HOUR_IN_SECONDS,
  },
);

export const getFeedPriceHistory = cache(
  async (cluster: Cluster, publisherKey: string, symbol: string) =>
    safeQuery(
      z.array(
        z.strictObject({
          time: z.string().transform((value) => new Date(value)),
          price: z.number(),
          confidence: z.number(),
        }),
      ),
      {
        query: `
          SELECT * FROM (
            SELECT time, price, confidence
            FROM prices
            WHERE publisher = {publisherKey: String}
            AND cluster = {cluster: String}
            AND symbol = {symbol: String}
            ORDER BY time DESC
            LIMIT 30
          )
          ORDER BY time ASC
        `,
        query_params: {
          cluster: ClusterToName[cluster],
          publisherKey,
          symbol,
        },
      },
    ),
  ["feed-price-history"],
  {
    revalidate: ONE_HOUR_IN_SECONDS,
  },
);

export const getPublisherMedianScoreHistory = cache(
  async (key: string) =>
    safeQuery(
      z.array(
        z.strictObject({
          time: z.string().transform((value) => new Date(value)),
          score: z.number(),
          uptimeScore: z.number(),
          deviationScore: z.number(),
          stalledScore: z.number(),
        }),
      ),
      {
        query: `
          SELECT * FROM (
            SELECT
              time,
              medianExact(final_score) AS score,
              medianExact(uptime_score) AS uptimeScore,
              medianExact(deviation_score) AS deviationScore,
              medianExact(stalled_score) AS stalledScore
            FROM default.publisher_quality_ranking
            WHERE publisher = {key: String}
            AND cluster = 'pythnet'
            GROUP BY time
            ORDER BY time DESC
            LIMIT 30
          )
          ORDER BY time ASC
        `,
        query_params: { key },
      },
    ),
  ["publisher-median-score-history"],
  {
    revalidate: ONE_HOUR_IN_SECONDS,
  },
);

const safeQuery = async <Output, Def extends ZodTypeDef, Input>(
  schema: ZodSchema<Output, Def, Input>,
  query: Omit<Parameters<typeof client.query>[0], "format">,
) => {
  const rows = await client.query({ ...query, format: "JSON" });
  const result = await rows.json();

  return schema.parse(result.data);
};
