import "server-only";

import { createClient } from "@clickhouse/client";
import { z } from "zod";

import { cache } from "../cache";
import { CLICKHOUSE } from "../config/server";

export const client = createClient(CLICKHOUSE);

export const getRankings = cache(async (symbol: string) => {
  const rows = await client.query({
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
  });
  const result = await rows.json();

  return rankingsSchema.parse(result.data);
});

const rankingsSchema = z.array(
  z.strictObject({
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
  }),
);
