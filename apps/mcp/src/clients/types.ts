import { z } from "zod";

// --- Zod Schemas (single source of truth) ---

const MarketSessionSchema = z
  .object({
    min_pub: z.number().nullable(),
    schedule: z.string(),
  })
  .passthrough();

export const FeedSchema = z
  .object({
    asset_type: z.string(),
    corporate_actions: z.array(z.unknown()).nullable().optional(),
    description: z.string(),
    // Futures expiry, in the regular session's time zone.
    expiration_time: z.string().nullable().optional(),
    exponent: z.number(),
    // Entitlement groups gating this feed; empty for ungated feeds.
    groups: z.array(z.string()).optional(),
    hermes_id: z.string().nullable(),
    instrument_type: z.string().optional(),
    market_sessions: z
      .record(z.string(), MarketSessionSchema.nullable())
      .optional(),
    min_channel: z.string(),
    name: z.string(),
    pyth_lazer_id: z.number(),
    quote_currency: z.string().nullable(),
    state: z.string(),
    symbol: z.string(),
    // Futures chain this contract belongs to, e.g. "VX".
    symbol_chain_id: z.string().nullable().optional(),
  })
  .passthrough();

export const FeedArraySchema = z.array(FeedSchema);

/** Minimal shape for the entitled_only list, where only IDs are needed. */
export const FeedIdArraySchema = z.array(
  z.object({ pyth_lazer_id: z.number() }).passthrough(),
);

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
