/**
 * Pyth Network type definitions
 * Comprehensive types for Hermes and Benchmarks API responses
 */

import { z } from 'zod';

// ============================================================================
// Price Feed Types
// ============================================================================

export const PriceFeedAttributesSchema = z.object({
  asset_type: z.string(),
  base: z.string(),
  description: z.string(),
  generic_symbol: z.string().optional(),
  quote_currency: z.string(),
  symbol: z.string(),
});

// Feed IDs may come with or without 0x prefix from the API
export const PriceFeedSchema = z.object({
  id: z.string().regex(/^(0x)?[a-fA-F0-9]{64}$/),
  attributes: PriceFeedAttributesSchema,
});

export type PriceFeedAttributes = z.infer<typeof PriceFeedAttributesSchema>;
export type PriceFeed = z.infer<typeof PriceFeedSchema>;

// ============================================================================
// Price Data Types
// ============================================================================

export const PriceDataSchema = z.object({
  price: z.string(),
  conf: z.string(),
  expo: z.number(),
  publish_time: z.number(),
});

export const PriceMetadataSchema = z.object({
  slot: z.number().optional(),
  proof_available_time: z.number().optional(),
  prev_publish_time: z.number().optional(),
});

export const ParsedPriceUpdateSchema = z.object({
  id: z.string(),
  price: PriceDataSchema,
  ema_price: PriceDataSchema,
  metadata: PriceMetadataSchema.optional(),
});

export const BinaryDataSchema = z.object({
  encoding: z.enum(['hex', 'base64']),
  data: z.array(z.string()),
});

export const PriceUpdateResponseSchema = z.object({
  binary: BinaryDataSchema.optional(),
  parsed: z.array(ParsedPriceUpdateSchema).optional(),
});

export type PriceData = z.infer<typeof PriceDataSchema>;
export type PriceMetadata = z.infer<typeof PriceMetadataSchema>;
export type ParsedPriceUpdate = z.infer<typeof ParsedPriceUpdateSchema>;
export type BinaryData = z.infer<typeof BinaryDataSchema>;
export type PriceUpdateResponse = z.infer<typeof PriceUpdateResponseSchema>;

// ============================================================================
// TWAP Types
// ============================================================================

export const TwapDataSchema = z.object({
  price: z.string(),
  conf: z.string(),
  expo: z.number(),
  publish_time: z.number(),
});

export const ParsedTwapUpdateSchema = z.object({
  id: z.string(),
  twap: TwapDataSchema,
  start_time: z.number(),
  end_time: z.number(),
});

export const TwapResponseSchema = z.object({
  binary: BinaryDataSchema.optional(),
  parsed: z.array(ParsedTwapUpdateSchema).optional(),
});

export type TwapData = z.infer<typeof TwapDataSchema>;
export type ParsedTwapUpdate = z.infer<typeof ParsedTwapUpdateSchema>;
export type TwapResponse = z.infer<typeof TwapResponseSchema>;

// ============================================================================
// Publisher Types
// ============================================================================

export const PublisherStakeCapSchema = z.object({
  publisher: z.string(),
  cap: z.string(),
});

// Publisher caps response can have nested object or direct array depending on API version
export const PublisherStakeCapsResponseSchema = z.object({
  binary: BinaryDataSchema.optional(),
  parsed: z
    .union([
      z.object({
        publisher_stake_caps: z.array(PublisherStakeCapSchema),
      }),
      z.array(PublisherStakeCapSchema),
    ])
    .optional(),
});

export type PublisherStakeCap = z.infer<typeof PublisherStakeCapSchema>;
export type PublisherStakeCapsResponse = z.infer<typeof PublisherStakeCapsResponseSchema>;

// ============================================================================
// Historical/Benchmarks Types
// ============================================================================

export const HistoricalPriceSchema = z.object({
  id: z.string(),
  price: PriceDataSchema,
  ema_price: PriceDataSchema.optional(),
  timestamp: z.number(),
});

export const OHLCVSchema = z.object({
  t: z.array(z.number()), // timestamps
  o: z.array(z.number()), // open
  h: z.array(z.number()), // high
  l: z.array(z.number()), // low
  c: z.array(z.number()), // close
  v: z.array(z.number()).optional(), // volume
  s: z.string(), // status
});

export type HistoricalPrice = z.infer<typeof HistoricalPriceSchema>;
export type OHLCV = z.infer<typeof OHLCVSchema>;

// ============================================================================
// Query Parameter Types
// ============================================================================

export const AssetTypeSchema = z.enum(['crypto', 'equity', 'fx', 'metal', 'rates']);
export type AssetType = z.infer<typeof AssetTypeSchema>;

export const EncodingSchema = z.enum(['hex', 'base64']);
export type Encoding = z.infer<typeof EncodingSchema>;

export interface PriceFeedQuery {
  query?: string;
  assetType?: AssetType;
}

export interface PriceUpdateQuery {
  feedIds: string[];
  encoding?: Encoding;
  parsed?: boolean;
  binary?: boolean;
}

export interface TwapQuery {
  feedIds: string[];
  windowSeconds?: number;
}

export interface HistoricalQuery {
  feedIds: string[];
  timestamp: number;
  encoding?: Encoding;
  parsed?: boolean;
}

export interface HistoricalRangeQuery extends HistoricalQuery {
  interval: number;
  unique?: boolean;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Convert Pyth price format to decimal number
 * actual_price = price * 10^expo
 */
export function priceToDecimal(price: string, expo: number): number {
  return Number(price) * Math.pow(10, expo);
}

/**
 * Format price for display with appropriate decimal places
 */
export function formatPrice(price: string, expo: number, decimals?: number): string {
  const value = priceToDecimal(price, expo);
  const decimalPlaces = decimals ?? Math.max(0, -expo);
  return value.toFixed(decimalPlaces);
}

/**
 * Validate a Pyth price feed ID
 */
export function isValidFeedId(id: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(id);
}

/**
 * Normalize feed ID to lowercase with 0x prefix
 */
export function normalizeFeedId(id: string): string {
  const normalized = id.toLowerCase();
  return normalized.startsWith('0x') ? normalized : `0x${normalized}`;
}
