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
          activeFeeds: z
            .string()
            .transform((value) => Number.parseInt(value, 10)),
          inactiveFeeds: z
            .string()
            .transform((value) => Number.parseInt(value, 10)),
          averageScore: z.number(),
          timestamp: z.string().transform((value) => new Date(`${value} UTC`)),
          scoreTime: z.string().transform((value) => new Date(value)),
        }),
      ),
      {
        query: `
          WITH score_data AS (
            SELECT
              publisher,
              time,
              avg(final_score) AS averageScore,
              countIf(uptime_score >= 0.5) AS activeFeeds,
              countIf(uptime_score < 0.5) AS inactiveFeeds
            FROM publisher_quality_ranking
            WHERE cluster = {cluster:String}
            AND time = (
              SELECT max(time)
              FROM publisher_quality_ranking
              WHERE cluster = {cluster:String}
              AND interval_days = 1
            )
            AND interval_days = 1
            GROUP BY publisher, time
          )
          SELECT
            timestamp,
            publisher AS key,
            rank,
            activeFeeds,
            inactiveFeeds,
            score_data.averageScore,
            score_data.time as scoreTime
          FROM publishers_ranking
          INNER JOIN score_data ON publishers_ranking.publisher = score_data.publisher
          WHERE cluster = {cluster:String}
          AND timestamp = (
            SELECT max(timestamp)
            FROM publishers_ranking
            WHERE cluster = {cluster:String}
          )
          ORDER BY rank ASC, timestamp
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
      SELECT
          time,
          symbol,
          cluster,
          publisher,
          uptime_score,
          deviation_score,
          stalled_score,
          final_score,
          final_rank
        FROM publisher_quality_ranking
        WHERE time = (SELECT max(time) FROM publisher_quality_ranking)
        AND publisher = {publisherKey: String}
        AND interval_days = 1
        ORDER BY
          symbol ASC,
          cluster ASC,
          publisher ASC
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
        SELECT
          time,
          symbol,
          cluster,
          publisher,
          uptime_score,
          deviation_score,
          stalled_score,
          final_score,
          final_rank
        FROM publisher_quality_ranking
        WHERE time = (SELECT max(time) FROM publisher_quality_ranking)
        AND symbol = {symbol: String}
        AND interval_days = 1
        ORDER BY
          symbol ASC,
          cluster ASC,
          publisher ASC
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
    time: z.string().transform((time) => new Date(time)),
    symbol: z.string(),
    cluster: z.enum(["pythnet", "pythtest-conformance"]),
    publisher: z.string(),
    uptime_score: z.number(),
    deviation_score: z.number(),
    stalled_score: z.number(),
    final_score: z.number(),
    final_rank: z.number(),
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
          FROM prices
          WHERE cluster = 'pythnet'
          AND symbol IN {symbols:Array(String)}
          AND time >= now() - toIntervalDay(1) - toIntervalMinute(10)
          AND time <= now() - toIntervalDay(1)
          ORDER BY time ASC
          LIMIT 1 BY symbol
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
            FROM publisher_quality_ranking
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

export const getPublisherAverageScoreHistory = cache(
  async (key: string) =>
    safeQuery(
      z.array(
        z.strictObject({
          time: z.string().transform((value) => new Date(value)),
          averageScore: z.number(),
        }),
      ),
      {
        query: `
          SELECT * FROM (
            SELECT
              time,
              avg(final_score) AS averageScore
            FROM publisher_quality_ranking
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
  ["publisher-average-score-history"],
  {
    revalidate: ONE_HOUR_IN_SECONDS,
  },
);

export const getHistoricalPrices = cache(
  async (symbol: string, until: string) =>
    safeQuery(
      z.array(
        z.strictObject({
          timestamp: z.number(),
          price: z.number(),
          confidence: z.number(),
        }),
      ),
      {
        query: `
          SELECT toUnixTimestamp(time) AS timestamp, avg(price) AS price, avg(confidence) AS confidence
          FROM prices
          WHERE cluster = 'pythnet'
          AND symbol = {symbol: String}
          AND version = 2
          AND time > fromUnixTimestamp(toInt64({until: String})) - INTERVAL 5 MINUTE
          AND time < fromUnixTimestamp(toInt64({until: String}))
          AND publisher = ''
          GROUP BY time
          ORDER BY time ASC
        `,
        query_params: { symbol, until },
      },
    ),
  ["price-history"],
  {},
);

const safeQuery = async <Output, Def extends ZodTypeDef, Input>(
  schema: ZodSchema<Output, Def, Input>,
  query: Omit<Parameters<typeof client.query>[0], "format">,
) => {
  const rows = await client.query({ ...query, format: "JSON" });
  const result = await rows.json();

  return schema.parse(result.data);
};
