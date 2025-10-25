import "server-only";

import { createClient } from "@clickhouse/client";
import { PriceStatus } from "@pythnetwork/client";
import type { ZodSchema, ZodTypeDef } from "zod";
import { z } from "zod";

import { Cluster, ClusterToName } from "./pyth";
import { redisCache } from "../cache";
import { CLICKHOUSE } from "../config/server";

const client = createClient(CLICKHOUSE);

const _getPublisherRankings = async (cluster: Cluster) =>
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
      query_params: { cluster: ClusterToName[cluster] },
    },
  );

const _getFeedRankingsByPublisher = async (publisherKey: string) =>
  safeQuery(rankingsSchema, {
    query: `
      WITH first_rankings AS (
        SELECT publisher, symbol, min(time) AS first_ranking_time
        FROM publisher_quality_ranking
        WHERE interval_days = 1
        GROUP BY (publisher, symbol)
      )

      SELECT
        time,
        symbol,
        cluster,
        publisher,
        first_ranking_time,
        uptime_score,
        deviation_score,
        stalled_score,
        final_score,
        final_rank
      FROM publisher_quality_ranking
      JOIN first_rankings
        ON first_rankings.publisher = publisher_quality_ranking.publisher
        AND first_rankings.symbol = publisher_quality_ranking.symbol
      WHERE time = (SELECT max(time) FROM publisher_quality_ranking)
      AND publisher = {publisherKey: String}
      AND interval_days = 1
      ORDER BY
        symbol ASC,
        cluster ASC,
        publisher ASC
    `,
    query_params: { publisherKey },
  });

const _getRankingsBySymbol = async (symbol: string) =>
  safeQuery(rankingsSchema, {
    query: `
      WITH first_rankings AS (
        SELECT publisher, symbol, min(time) AS first_ranking_time
        FROM publisher_quality_ranking
        WHERE interval_days = 1
        GROUP BY (publisher, symbol)
      )

      SELECT
        time,
        symbol,
        cluster,
        publisher,
        first_ranking_time,
        uptime_score,
        deviation_score,
        stalled_score,
        final_score,
        final_rank
      FROM publisher_quality_ranking
      JOIN first_rankings
        ON first_rankings.publisher = publisher_quality_ranking.publisher
        AND first_rankings.symbol = publisher_quality_ranking.symbol
      WHERE time = (SELECT max(time) FROM publisher_quality_ranking)
      AND symbol = {symbol: String}
      AND interval_days = 1
      ORDER BY
        symbol ASC,
        cluster ASC,
        publisher ASC
      `,
    query_params: { symbol },
  });

const rankingsSchema = z.array(
  z.strictObject({
    time: z.string().transform((time) => new Date(time)),
    first_ranking_time: z.string().transform((time) => new Date(time)),
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

const _getYesterdaysPrices = async (symbols: string[]) =>
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
  );

const _getPublisherRankingHistory = async ({
  cluster,
  key,
}: {
  cluster: Cluster;
  key: string;
}) =>
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
            AND cluster = {cluster: String}
            ORDER BY timestamp DESC
            LIMIT 30
          )
          ORDER BY timestamp ASC
        `,
      query_params: { key, cluster: ClusterToName[cluster] },
    },
  );

// note that this is not cached as the `from`/`to` params are unix timestamps
export const getFeedScoreHistory = async ({
  cluster,
  publisherKey,
  symbol,
  from,
  to,
}: {
  cluster: Cluster;
  publisherKey: string;
  symbol: string;
  from: string;
  to: string;
}) =>
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
        AND interval_days = 1
        AND time >= toDateTime64({from: String}, 3)
        AND time <= toDateTime64({to: String}, 3)
        ORDER BY time ASC
      `,
      query_params: {
        cluster: ClusterToName[cluster],
        publisherKey,
        symbol,
        from,
        to,
      },
    },
  );

const _getFeedPriceHistory = async ({
  cluster,
  publisherKey,
  symbol,
}: {
  cluster: Cluster;
  publisherKey: string;
  symbol: string;
}) =>
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
  );

const _getPublisherAverageScoreHistory = async ({
  cluster,
  key,
}: {
  cluster: Cluster;
  key: string;
}) =>
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
            AND cluster = {cluster: String}
            AND interval_days = 1
            GROUP BY time
            ORDER BY time DESC
            LIMIT 30
          )
          ORDER BY time ASC
        `,
      query_params: { key, cluster: ClusterToName[cluster] },
    },
  );

type ResolutionUnit = "SECOND" | "MINUTE" | "HOUR" | "DAY";
type Resolution = `${number} ${ResolutionUnit}`;
// note that this is not cached as `from` and `to` params are unix timestamps
export const getHistoricalPrices = async ({
  symbol,
  from,
  to,
  publisher = "",
  resolution = "1 MINUTE",
}: {
  symbol: string;
  from: number;
  to: number;
  publisher: string | undefined;
  resolution?: Resolution;
}) => {
  const queryParams: Record<string, number | string | string[]> = {
    symbol,
    from,
    to,
    publisher,
    cluster: "pythnet",
  };

  return safeQuery(
    z.array(
      z.strictObject({
        timestamp: z.number(),
        price: z.number(),
        confidence: z.number(),
        status: z.nativeEnum(PriceStatus),
      }),
    ),
    {
      query: `
          SELECT toUnixTimestamp(toStartOfInterval(publishTime, INTERVAL ${resolution})) AS timestamp, avg(price) AS price, avg(confidence) AS confidence, status
          FROM prices
          PREWHERE
            cluster = {cluster: String}
            AND publisher = {publisher: String}
            AND symbol = {symbol: String}
            AND version = 2
          WHERE
            publishTime >= toDateTime({from: UInt32})
            AND publishTime < toDateTime({to: UInt32})
          GROUP BY timestamp, status
          ORDER BY timestamp ASC
        `,
      query_params: queryParams,
    },
  );
};

const safeQuery = async <Output, Def extends ZodTypeDef, Input>(
  schema: ZodSchema<Output, Def, Input>,
  query: Omit<Parameters<typeof client.query>[0], "format">,
) => {
  const rows = await client.query({ ...query, format: "JSON" });
  const result = await rows.json();

  return schema.parse(result.data);
};

export const getRankingsBySymbol = redisCache.define(
  "getRankingsBySymbol",
  _getRankingsBySymbol,
).getRankingsBySymbol;

export const getFeedRankingsByPublisher = redisCache.define(
  "getFeedRankingsByPublisher",
  _getFeedRankingsByPublisher,
).getFeedRankingsByPublisher;

export const getPublisherRankings = redisCache.define(
  "getPublisherRankings",
  _getPublisherRankings,
).getPublisherRankings;

export const getPublisherAverageScoreHistory = redisCache.define(
  "getPublisherAverageScoreHistory",
  _getPublisherAverageScoreHistory,
).getPublisherAverageScoreHistory;

export const getPublisherRankingHistory = redisCache.define(
  "getPublisherRankingHistory",
  _getPublisherRankingHistory,
).getPublisherRankingHistory;

export const getFeedPriceHistory = redisCache.define(
  "getFeedPriceHistory",
  _getFeedPriceHistory,
).getFeedPriceHistory;

export const getYesterdaysPrices = redisCache.define(
  "getYesterdaysPrices",
  _getYesterdaysPrices,
).getYesterdaysPrices;
