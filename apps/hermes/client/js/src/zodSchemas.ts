import { makeApi, Zodios, type ZodiosOptions } from "@zodios/core";
import { z } from "zod";

const AssetType = z.enum(["crypto", "fx", "equity", "metals", "rates"]);
const asset_type = AssetType.nullish();
const RpcPriceIdentifier = z.string();
const PriceFeedMetadata = z
  .object({ attributes: z.record(z.string()), id: RpcPriceIdentifier })
  .passthrough();
const PriceIdInput = z.string();
const EncodingType = z.enum(["hex", "base64"]);
const BinaryPriceUpdate = z
  .object({ data: z.array(z.string()), encoding: EncodingType })
  .passthrough();
const RpcPrice = z
  .object({
    conf: z.string(),
    expo: z.number().int(),
    price: z.string(),
    publish_time: z.number().int(),
  })
  .passthrough();
const RpcPriceFeedMetadataV2 = z
  .object({
    prev_publish_time: z.number().int().nullable(),
    proof_available_time: z.number().int().nullable(),
    slot: z.number().int().gte(0).nullable(),
  })
  .partial()
  .passthrough();
const ParsedPriceUpdate = z
  .object({
    ema_price: RpcPrice,
    id: RpcPriceIdentifier,
    metadata: RpcPriceFeedMetadataV2,
    price: RpcPrice,
  })
  .passthrough();
const PriceUpdate = z
  .object({
    binary: BinaryPriceUpdate,
    parsed: z.array(ParsedPriceUpdate).nullish(),
  })
  .passthrough();

export const schemas = {
  AssetType,
  asset_type,
  RpcPriceIdentifier,
  PriceFeedMetadata,
  PriceIdInput,
  EncodingType,
  BinaryPriceUpdate,
  RpcPrice,
  RpcPriceFeedMetadataV2,
  ParsedPriceUpdate,
  PriceUpdate,
};

const endpoints = makeApi([
  {
    method: "get",
    path: "/v2/price_feeds",
    alias: "price_feeds_metadata",
    description: `Get the set of price feeds.

This endpoint fetches all price feeds from the Pyth network. It can be filtered by asset type
and query string.`,
    requestFormat: "json",
    parameters: [
      {
        name: "query",
        type: "Query",
        schema: z.string().nullish(),
      },
      {
        name: "asset_type",
        type: "Query",
        schema: asset_type,
      },
    ],
    response: z.array(PriceFeedMetadata),
  },
  {
    method: "get",
    path: "/v2/updates/price/:publish_time",
    alias: "timestamp_price_updates",
    description: `Get the latest price updates by price feed id.

Given a collection of price feed ids, retrieve the latest Pyth price for each price feed.`,
    requestFormat: "json",
    parameters: [
      {
        name: "publish_time",
        type: "Path",
        schema: z.number().int(),
      },
      {
        name: "ids[]",
        type: "Query",
        schema: z.array(PriceIdInput),
      },
      {
        name: "encoding",
        type: "Query",
        schema: z.enum(["hex", "base64"]).optional(),
      },
      {
        name: "parsed",
        type: "Query",
        schema: z.boolean().optional(),
      },
    ],
    response: PriceUpdate,
    errors: [
      {
        status: 404,
        description: `Price ids not found`,
        schema: z.void(),
      },
    ],
  },
  {
    method: "get",
    path: "/v2/updates/price/latest",
    alias: "latest_price_updates",
    description: `Get the latest price updates by price feed id.

Given a collection of price feed ids, retrieve the latest Pyth price for each price feed.`,
    requestFormat: "json",
    parameters: [
      {
        name: "ids[]",
        type: "Query",
        schema: z.array(PriceIdInput),
      },
      {
        name: "encoding",
        type: "Query",
        schema: z.enum(["hex", "base64"]).optional(),
      },
      {
        name: "parsed",
        type: "Query",
        schema: z.boolean().optional(),
      },
    ],
    response: PriceUpdate,
    errors: [
      {
        status: 404,
        description: `Price ids not found`,
        schema: z.void(),
      },
    ],
  },
  {
    method: "get",
    path: "/v2/updates/price/stream",
    alias: "price_stream_sse_handler",
    description: `SSE route handler for streaming price updates.`,
    requestFormat: "json",
    parameters: [
      {
        name: "ids[]",
        type: "Query",
        schema: z.array(PriceIdInput),
      },
      {
        name: "encoding",
        type: "Query",
        schema: z.enum(["hex", "base64"]).optional(),
      },
      {
        name: "parsed",
        type: "Query",
        schema: z.boolean().optional(),
      },
      {
        name: "allow_unordered",
        type: "Query",
        schema: z.boolean().optional(),
      },
      {
        name: "benchmarks_only",
        type: "Query",
        schema: z.boolean().optional(),
      },
    ],
    response: PriceUpdate,
    errors: [
      {
        status: 404,
        description: `Price ids not found`,
        schema: z.void(),
      },
    ],
  },
]);

export const api = new Zodios(endpoints);

export function createApiClient(baseUrl: string, options?: ZodiosOptions) {
  return new Zodios(baseUrl, endpoints, options);
}
