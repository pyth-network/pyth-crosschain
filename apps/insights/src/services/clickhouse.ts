import "server-only";

import { createClient } from "@clickhouse/client";
import { z, type ZodSchema, type ZodTypeDef } from "zod";

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
        query:
          "SELECT key, rank, numSymbols, medianScore FROM insights_publishers(cluster={cluster: String})",
        query_params: { cluster: "pythnet" },
      },
    ),
  ["publishers"],
  {
    revalidate: ONE_HOUR_IN_SECONDS,
  },
);

export const getRankings = cache(
  async (symbol: string) =>
    safeQuery(
      z.array(
        rankingSchema.extend({
          cluster: z.enum(["pythnet", "pythtest-conformance"]),
          publisher: z.string(),
        }),
      ),
      {
        query: `
      SELECT
        cluster,
        publisher,
        uptime_score,
        uptime_rank,
        deviation_penalty,
        deviation_score,
        deviation_rank,
        stalled_penalty,
        stalled_score,
        stalled_rank,
        final_score
      FROM insights_feed_component_rankings(symbol={symbol: String})
    `,
        query_params: { symbol },
      },
    ),
  ["rankings"],
  {
    revalidate: ONE_HOUR_IN_SECONDS,
  },
);

export const getPublisherFeeds = cache(
  async (publisherKey: string) =>
    safeQuery(
      z.array(
        rankingSchema.extend({
          symbol: z.string(),
        }),
      ),
      {
        query: `
      SELECT
        symbol,
        uptime_score,
        uptime_rank,
        deviation_penalty,
        deviation_score,
        deviation_rank,
        stalled_penalty,
        stalled_score,
        stalled_rank,
        final_score
      FROM insights_feeds_for_publisher(publisherKey={publisherKey: String})
    `,
        query_params: { publisherKey },
      },
    ),
  ["publisher-feeds"],
  {
    revalidate: ONE_HOUR_IN_SECONDS,
  },
);

const rankingSchema = z.strictObject({
  uptime_score: z.number(),
  uptime_rank: z.number(),
  deviation_penalty: z.number().nullable(),
  deviation_score: z.number(),
  deviation_rank: z.number(),
  stalled_penalty: z.number(),
  stalled_score: z.number(),
  stalled_rank: z.number(),
  final_score: z.number(),
});

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
        query:
          "select symbol, price from insights_yesterdays_prices(symbols={symbols: Array(String)})",
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

export const getPublisherMedianScoreHistory = cache(
  async (key: string) =>
    safeQuery(
      z.array(
        z.strictObject({
          time: z.string().transform((value) => new Date(value)),
          medianScore: z.number(),
          medianUptimeScore: z.number(),
          medianDeviationScore: z.number(),
          medianStalledScore: z.number(),
        }),
      ),
      {
        query: `
        SELECT * FROM (
          SELECT
            time,
            medianExact(final_score) AS medianScore,
            medianExact(uptime_score) AS medianUptimeScore,
            medianExact(deviation_score) AS medianDeviationScore,
            medianExact(stalled_score) AS medianStalledScore
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
