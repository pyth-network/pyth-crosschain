import { z } from "zod";

// --- Zod Schemas (single source of truth) ---

export const FeedSchema = z.object({
  asset_type: z.string(),
  description: z.string(),
  exponent: z.number(),
  hermes_id: z.string().nullable(),
  min_channel: z.string(),
  name: z.string(),
  pyth_lazer_id: z.number(),
  quote_currency: z.string(),
  state: z.string(),
  symbol: z.string(),
});

export const FeedArraySchema = z.array(FeedSchema);

export const OHLCResponseSchema = z.object({
  c: z.array(z.number()),
  errmsg: z.string().optional(),
  h: z.array(z.number()),
  l: z.array(z.number()),
  o: z.array(z.number()),
  s: z.enum(["ok", "no_data", "error"]),
  t: z.array(z.number()),
  v: z.array(z.number()),
});

export const HistoricalPriceResponseSchema = z
  .object({
    best_ask_price: z.number().nullable().optional(),
    best_bid_price: z.number().nullable().optional(),
    channel: z.union([z.string(), z.number()]),
    confidence: z.number().nullable().optional(),
    exponent: z.number().nullable().optional(),
    price: z.number(),
    price_feed_id: z.number(),
    publish_time: z.number(),
    publisher_count: z.number().nullable().optional(),
  })
  .passthrough();

export const HistoricalPriceArraySchema = z.array(
  HistoricalPriceResponseSchema,
);

/** Raw feed shape from Router API (camelCase, string numbers) */
export const LatestPriceRawFeedSchema = z
  .object({
    bestAskPrice: z.union([z.string(), z.number()]).optional(),
    bestBidPrice: z.union([z.string(), z.number()]).optional(),
    confidence: z.union([z.string(), z.number()]).optional(),
    exponent: z.number().optional(),
    price: z.union([z.string(), z.number()]).optional(),
    priceFeedId: z.number(),
    publisherCount: z.number().optional(),
  })
  .passthrough();

export const LatestPriceResponseSchema = z.object({
  parsed: z.object({
    priceFeeds: z.array(LatestPriceRawFeedSchema),
    timestampUs: z.union([z.string(), z.number()]),
  }),
});

/** Normalized feed shape used internally (snake_case, numeric values) */
export const LatestPriceParsedFeedSchema = z
  .object({
    best_ask_price: z.number().optional(),
    best_bid_price: z.number().optional(),
    confidence: z.number().optional(),
    exponent: z.number().optional(),
    price: z.number().optional(),
    price_feed_id: z.number(),
    publisher_count: z.number().optional(),
    timestamp_us: z.number(),
  })
  .passthrough();

// --- Inferred Types ---

export type Feed = z.infer<typeof FeedSchema>;
export type OHLCResponse = z.infer<typeof OHLCResponseSchema>;
export type HistoricalPriceResponse = z.infer<
  typeof HistoricalPriceResponseSchema
>;
export type LatestPriceParsedFeed = z.infer<typeof LatestPriceParsedFeedSchema>;
export type LatestPriceResponse = z.infer<typeof LatestPriceResponseSchema>;
