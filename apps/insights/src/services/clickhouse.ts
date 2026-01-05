import "server-only";

import { createClient } from "@clickhouse/client";
import { PriceStatus } from "@pythnetwork/client";
import type { ZodSchema, ZodTypeDef } from "zod";
import { z } from "zod";

import { Cluster, ClusterToName } from "./pyth";
import { redisCache } from "../cache";
import {
  CLICKHOUSE,
  CLICKHOUSE_PYTH_ANALYTICS,
  CLICKHOUSE_PYTH_PRO,
} from "../config/server";

const pythCoreClient = createClient(CLICKHOUSE);
const pythProClient = createClient(CLICKHOUSE_PYTH_PRO);
const pythAnalyticsClient = createClient(CLICKHOUSE_PYTH_ANALYTICS);

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

const GetPriceFeedMetadataForSymbolSchema = z.object({
  minChannel: z.string(),
  name: z.string().nonempty(),
  pythCoreId: z.string(),
});

/**
 * Given a symbol, like AMZN, TSLA, BTCUSD or even EURUSD,
 * grabs
 */
export async function getPythProPriceFeedMetadataForSymbol(symbol: string) {
  if (!symbol) {
    throw new Error(
      "no symbol was provided when getPythProPriceFeedMetadataForSymbol called",
    );
  }

  const results = await safeQuery(
    z.array(GetPriceFeedMetadataForSymbolSchema),
    {
      query: `SELECT
    DISTINCT f.pyth_lazer_id as pythLazerId,
    f.name as name,
    f.hermes_id as pythCoreId,
    f.min_channel as minChannel
FROM feeds_metadata_latest f
PREWHERE
    f.state = 'stable'
        AND f.description not like '%deprecated%'
WHERE name = {name: String}
LIMIT 10
OFFSET 0`,
      query_params: { name: symbol },
    },
    pythProClient,
  );

  return results[0];
}

const GetPythProFeedPricesOptsSchema = z.object({
  end: z.string().datetime().nonempty(),
  symbol: z.string().nonempty(),
  start: z.string().datetime().nonempty(),
});

type GetPythProFeedPricesOpts = z.infer<typeof GetPythProFeedPricesOptsSchema>;

const GetPythHistoricalPricesFromDBSchema = z.object({
  ask: z.number().optional().nullable(),
  bid: z.number().optional().nullable(),
  exponent: z.number(),
  price: z.number().optional().nullable(),
  timestamp: z.string().datetime(),
});
const GetPythHistoricalPricesSchema = GetPythHistoricalPricesFromDBSchema.omit({
  exponent: true,
}).extend({
  source: z.enum(["nbbo", "pyth_pro"]),
  symbol: z.string().nonempty(),
});
type GetPythHistoricalPricesType = z.infer<
  typeof GetPythHistoricalPricesSchema
>;

const GetPythHistoricalPricesReturnTypeSchema = z.array(
  GetPythHistoricalPricesSchema,
);

/**
 * fetches only NBBO historical pricing data for the provided symbol
 */
export async function getNbboHistoricalPrices(
  opts: GetPythProFeedPricesOpts,
): Promise<GetPythHistoricalPricesType[]> {
  const dbNames = [
    "datascope_futures_benchmark_data",
    "datascope_fx_benchmark_data",
    "datascope_global_equities_benchmark_data",
    "datascope_us_treasury_benchmark_data",
  ];

  const results = await Promise.all(dbNames.map(async (dbName) => {}));
  return [];
}

/**
 * fetches a chunk of pricing information for either PythPro, PythCore
 * or NBBO sources
 */
export async function getPythProHistoricalPrices(
  opts: GetPythProFeedPricesOpts,
): Promise<GetPythHistoricalPricesType[]> {
  const validatedOpts = GetPythProFeedPricesOptsSchema.safeParse(opts);
  if (validatedOpts.error) {
    throw new Error(validatedOpts.error.format()._errors.join(", "));
  }

  const {
    data: { end, start, symbol },
  } = validatedOpts;

  const meta = await getPythProPriceFeedMetadataForSymbol(symbol);

  if (!meta) {
    throw new Error(`no feed metadata exists for symbol ${symbol}`);
  }

  const { name, pythCoreId } = meta;

  const results = await safeQuery(
    z.array(GetPythHistoricalPricesFromDBSchema),
    {
      query: `SELECT
  pf.publish_time as timestamp,
  pf.best_ask_price as ask,
  pf.best_bid_price as bid,
  pf.price,
  pf.exponent
FROM price_feeds pf
PREWHERE
  pf.price_feed_id = {feedId: UInt32}
    AND pf.state = 'STABLE'
WHERE pf.publish_time >= parseDateTimeBestEffort({start: String})
    AND pf.publish_time < parseDateTimeBestEffort({end: String})
ORDER BY pf.publish_time ASC
OFFSET 0`,
      query_params: {
        end,
        feedId: pythCoreId,
        start,
      },
    },
    pythProClient,
  );

  const out = results.map<GetPythHistoricalPricesType>((r) => ({
    ...r,
    symbol: name,
    source: "pyth_pro",
  }));
  const validatedOut = GetPythHistoricalPricesReturnTypeSchema.safeParse(out);
  if (validatedOut.error) {
    throw new Error(validatedOut.error.format()._errors.join(", "));
  }
  return validatedOut.data;
}

const safeQuery = async <Output, Def extends ZodTypeDef, Input>(
  schema: ZodSchema<Output, Def, Input>,
  query: Omit<Parameters<typeof pythCoreClient.query>[0], "format">,
  clientToUse = pythCoreClient,
) => {
  const rows = await clientToUse.query({ ...query, format: "JSON" });
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
