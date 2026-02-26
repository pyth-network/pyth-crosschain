/**
 * MCP Tool Handlers for Pyth Network
 */

import { getHermesClient } from '../api/hermes.js';
import { getBenchmarksClient, type TradingViewResolution } from '../api/benchmarks.js';
import { POPULAR_FEEDS, NETWORK_STATS } from '../api/config.js';
import { formatPrice, priceToDecimal, type AssetType } from '../types/pyth.js';
import { wrapError, type PythError } from '../types/errors.js';

/**
 * Tool response wrapper for consistent output
 */
interface ToolResponse {
  success: boolean;
  data?: unknown;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  metadata?: {
    timestamp: number;
    latencyMs?: number;
  };
}

function successResponse(data: unknown, startTime?: number): ToolResponse {
  const response: ToolResponse = {
    success: true,
    data,
    metadata: {
      timestamp: Date.now(),
    },
  };

  if (startTime) {
    response.metadata!.latencyMs = Date.now() - startTime;
  }

  return response;
}

function errorResponse(error: PythError): ToolResponse {
  return {
    success: false,
    error: {
      code: error.code,
      message: error.message,
      details: error.details,
    },
    metadata: {
      timestamp: Date.now(),
    },
  };
}

/**
 * Handle tool calls
 */
export async function handleToolCall(
  name: string,
  args: Record<string, unknown>
): Promise<ToolResponse> {
  const startTime = Date.now();

  try {
    switch (name) {
      case 'get_price_feeds':
        return await handleGetPriceFeeds(args, startTime);

      case 'get_latest_price':
        return await handleGetLatestPrice(args, startTime);

      case 'get_price_at_timestamp':
        return await handleGetPriceAtTimestamp(args, startTime);

      case 'get_ema_price':
        return await handleGetEmaPrice(args, startTime);

      case 'get_twap':
        return await handleGetTwap(args, startTime);

      case 'get_publisher_caps':
        return await handleGetPublisherCaps(startTime);

      case 'get_price_feed_info':
        return await handleGetPriceFeedInfo(args, startTime);

      case 'get_historical_prices':
        return await handleGetHistoricalPrices(args, startTime);

      case 'get_ohlcv':
        return await handleGetOHLCV(args, startTime);

      case 'search_symbols':
        return await handleSearchSymbols(args, startTime);

      case 'get_popular_feeds':
        return handleGetPopularFeeds(args, startTime);

      default:
        return {
          success: false,
          error: {
            code: 'UNKNOWN_TOOL',
            message: `Unknown tool: ${name}`,
          },
          metadata: { timestamp: Date.now() },
        };
    }
  } catch (error) {
    return errorResponse(wrapError(error));
  }
}

// ============================================================================
// Tool Handlers
// ============================================================================

async function handleGetPriceFeeds(
  args: Record<string, unknown>,
  startTime: number
): Promise<ToolResponse> {
  const client = getHermesClient();

  // Build query object without undefined values (exactOptionalPropertyTypes)
  const query: { query?: string; assetType?: AssetType } = {};
  if (args['query'] !== undefined) {
    query.query = args['query'] as string;
  }
  if (args['asset_type'] !== undefined) {
    query.assetType = args['asset_type'] as AssetType;
  }

  const feeds = await client.getPriceFeeds(query);

  // Format for readability
  const formattedFeeds = feeds.slice(0, 50).map(feed => ({
    id: feed.id,
    symbol: feed.attributes.symbol,
    description: feed.attributes.description,
    assetType: feed.attributes.asset_type,
    base: feed.attributes.base,
    quote: feed.attributes.quote_currency,
  }));

  return successResponse(
    {
      totalFeeds: feeds.length,
      feeds: formattedFeeds,
      note: feeds.length > 50 ? `Showing first 50 of ${feeds.length} results` : undefined,
    },
    startTime
  );
}

async function handleGetLatestPrice(
  args: Record<string, unknown>,
  startTime: number
): Promise<ToolResponse> {
  const feedIds = args['feed_ids'] as string[];
  const client = getHermesClient();

  const response = await client.getLatestPrices({
    feedIds,
    parsed: true,
  });

  if (!response.parsed || response.parsed.length === 0) {
    return successResponse({ prices: [], note: 'No price data available' }, startTime);
  }

  const prices = response.parsed.map(update => {
    const price = priceToDecimal(update.price.price, update.price.expo);
    const confidence = priceToDecimal(update.price.conf, update.price.expo);
    const emaPrice = priceToDecimal(update.ema_price.price, update.ema_price.expo);

    return {
      feedId: update.id,
      price: price,
      priceFormatted: formatPrice(update.price.price, update.price.expo),
      confidence: confidence,
      confidencePercent: ((confidence / price) * 100).toFixed(4) + '%',
      emaPrice: emaPrice,
      publishTime: update.price.publish_time,
      publishTimeISO: new Date(update.price.publish_time * 1000).toISOString(),
    };
  });

  return successResponse({ prices }, startTime);
}

async function handleGetPriceAtTimestamp(
  args: Record<string, unknown>,
  startTime: number
): Promise<ToolResponse> {
  const feedIds = args['feed_ids'] as string[];
  const timestamp = args['timestamp'] as number;
  const client = getHermesClient();

  const response = await client.getPriceAtTimestamp({
    feedIds,
    timestamp,
    parsed: true,
  });

  if (!response.parsed || response.parsed.length === 0) {
    return successResponse(
      { prices: [], note: 'No price data available for this timestamp' },
      startTime
    );
  }

  const prices = response.parsed.map(update => ({
    feedId: update.id,
    price: priceToDecimal(update.price.price, update.price.expo),
    priceFormatted: formatPrice(update.price.price, update.price.expo),
    confidence: priceToDecimal(update.price.conf, update.price.expo),
    requestedTimestamp: timestamp,
    actualPublishTime: update.price.publish_time,
  }));

  return successResponse({ prices }, startTime);
}

async function handleGetEmaPrice(
  args: Record<string, unknown>,
  startTime: number
): Promise<ToolResponse> {
  const feedIds = args['feed_ids'] as string[];
  const client = getHermesClient();

  const response = await client.getLatestPrices({
    feedIds,
    parsed: true,
  });

  if (!response.parsed || response.parsed.length === 0) {
    return successResponse({ emaPrices: [], note: 'No EMA price data available' }, startTime);
  }

  const emaPrices = response.parsed.map(update => {
    const currentPrice = priceToDecimal(update.price.price, update.price.expo);
    const emaPrice = priceToDecimal(update.ema_price.price, update.ema_price.expo);
    const emaConfidence = priceToDecimal(update.ema_price.conf, update.ema_price.expo);
    const deviation = ((currentPrice - emaPrice) / emaPrice) * 100;

    return {
      feedId: update.id,
      emaPrice: emaPrice,
      emaPriceFormatted: formatPrice(update.ema_price.price, update.ema_price.expo),
      emaConfidence: emaConfidence,
      currentPrice: currentPrice,
      currentPriceFormatted: formatPrice(update.price.price, update.price.expo),
      deviationFromEma: deviation.toFixed(4) + '%',
      publishTime: update.ema_price.publish_time,
      publishTimeISO: new Date(update.ema_price.publish_time * 1000).toISOString(),
    };
  });

  return successResponse({ emaPrices }, startTime);
}

async function handleGetTwap(
  args: Record<string, unknown>,
  startTime: number
): Promise<ToolResponse> {
  const feedIds = args['feed_ids'] as string[];
  const windowSeconds = (args['window_seconds'] as number) ?? 60;
  const client = getHermesClient();

  const response = await client.getTwap({
    feedIds,
    windowSeconds,
  });

  if (!response.parsed || response.parsed.length === 0) {
    return successResponse({ twapPrices: [], note: 'No TWAP data available' }, startTime);
  }

  const twapPrices = response.parsed.map(update => {
    const twapPrice = priceToDecimal(update.twap.price, update.twap.expo);
    const twapConfidence = priceToDecimal(update.twap.conf, update.twap.expo);

    return {
      feedId: update.id,
      twapPrice: twapPrice,
      twapPriceFormatted: formatPrice(update.twap.price, update.twap.expo),
      twapConfidence: twapConfidence,
      confidencePercent: ((twapConfidence / twapPrice) * 100).toFixed(4) + '%',
      windowSeconds: windowSeconds,
      startTime: update.start_time,
      endTime: update.end_time,
      startTimeISO: new Date(update.start_time * 1000).toISOString(),
      endTimeISO: new Date(update.end_time * 1000).toISOString(),
    };
  });

  return successResponse({ twapPrices }, startTime);
}

async function handleGetPublisherCaps(startTime: number): Promise<ToolResponse> {
  const client = getHermesClient();
  const response = await client.getPublisherStakeCaps();

  if (!response.parsed) {
    return successResponse({ caps: [], note: 'No publisher data available' }, startTime);
  }

  const caps = response.parsed.publisher_stake_caps.map(cap => ({
    publisher: cap.publisher,
    stakeCap: cap.cap,
  }));

  return successResponse(
    {
      totalPublishers: caps.length,
      caps: caps.slice(0, 20),
      note: caps.length > 20 ? `Showing first 20 of ${caps.length} publishers` : undefined,
    },
    startTime
  );
}

async function handleGetPriceFeedInfo(
  args: Record<string, unknown>,
  startTime: number
): Promise<ToolResponse> {
  const feedId = args['feed_id'] as string;
  const client = getBenchmarksClient();

  const feed = await client.getPriceFeed(feedId);

  return successResponse(
    {
      id: feed.id,
      symbol: feed.attributes.symbol,
      description: feed.attributes.description,
      assetType: feed.attributes.asset_type,
      base: feed.attributes.base,
      quoteCurrency: feed.attributes.quote_currency,
      genericSymbol: feed.attributes.generic_symbol,
    },
    startTime
  );
}

async function handleGetHistoricalPrices(
  args: Record<string, unknown>,
  startTime: number
): Promise<ToolResponse> {
  const feedIds = args['feed_ids'] as string[];
  const startTimestamp = args['start_timestamp'] as number;
  const intervalSeconds = args['interval_seconds'] as number;
  const client = getBenchmarksClient();

  const responses = await client.getHistoricalPrices({
    feedIds,
    timestamp: startTimestamp,
    interval: intervalSeconds,
    parsed: true,
  });

  const prices = responses.flatMap(response =>
    (response.parsed ?? []).map(update => ({
      feedId: update.id,
      price: priceToDecimal(update.price.price, update.price.expo),
      publishTime: update.price.publish_time,
    }))
  );

  return successResponse({ prices, count: prices.length }, startTime);
}

async function handleGetOHLCV(
  args: Record<string, unknown>,
  startTime: number
): Promise<ToolResponse> {
  const symbol = args['symbol'] as string;
  const resolution = args['resolution'] as TradingViewResolution;
  const from = args['from'] as number;
  const to = args['to'] as number;
  const client = getBenchmarksClient();

  const ohlcv = await client.getOHLCV(symbol, resolution, from, to);

  // Format for easier consumption
  const candles =
    ohlcv.t?.map((timestamp, i) => ({
      timestamp,
      open: ohlcv.o?.[i],
      high: ohlcv.h?.[i],
      low: ohlcv.l?.[i],
      close: ohlcv.c?.[i],
      volume: ohlcv.v?.[i],
    })) ?? [];

  return successResponse(
    {
      symbol,
      resolution,
      status: ohlcv.s,
      candleCount: candles.length,
      candles: candles.slice(0, 100),
      note: candles.length > 100 ? `Showing first 100 of ${candles.length} candles` : undefined,
    },
    startTime
  );
}

async function handleSearchSymbols(
  args: Record<string, unknown>,
  startTime: number
): Promise<ToolResponse> {
  const query = args['query'] as string;
  const limit = (args['limit'] as number) ?? 30;
  const client = getBenchmarksClient();

  // Build options object without undefined values (exactOptionalPropertyTypes)
  const options: { type?: string; limit?: number } = { limit };
  if (args['type'] !== undefined) {
    options.type = args['type'] as string;
  }

  const results = await client.searchSymbols(query, options);

  return successResponse(
    {
      query,
      resultCount: results.length,
      symbols: results,
    },
    startTime
  );
}

function handleGetPopularFeeds(
  args: Record<string, unknown>,
  startTime: number
): ToolResponse {
  const category = (args['category'] as string) ?? 'all';

  let feeds: Record<string, string>;

  switch (category) {
    case 'crypto':
      feeds = POPULAR_FEEDS.crypto;
      break;
    case 'stablecoins':
      feeds = POPULAR_FEEDS.stablecoins;
      break;
    case 'equities':
      feeds = POPULAR_FEEDS.equities;
      break;
    case 'fx':
      feeds = POPULAR_FEEDS.fx;
      break;
    case 'metals':
      feeds = POPULAR_FEEDS.metals;
      break;
    case 'all':
    default:
      feeds = {
        ...POPULAR_FEEDS.crypto,
        ...POPULAR_FEEDS.stablecoins,
        ...POPULAR_FEEDS.equities,
        ...POPULAR_FEEDS.fx,
        ...POPULAR_FEEDS.metals,
      };
  }

  const feedList = Object.entries(feeds).map(([symbol, id]) => ({
    symbol,
    feedId: id,
  }));

  return successResponse(
    {
      category,
      feeds: feedList,
      networkStats: NETWORK_STATS,
    },
    startTime
  );
}
