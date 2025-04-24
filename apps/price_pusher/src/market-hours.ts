import axios from "axios";
import { PricePusherMetrics } from "./metrics";
import { Logger } from "pino";

// Types
export interface MarketHours {
  is_open: boolean;
  next_open: number | null;
  next_close: number | null;
}

export interface PriceAttributes {
  symbol: string;
  asset_type: string;
  base: string;
  description: string;
  display_symbol: string;
  generic_symbol: string;
  quote_currency: string;
  schedule: string;
}

export interface PriceFeed {
  id: string;
  market_hours: MarketHours;
  attributes: PriceAttributes;
}

export async function fetchPriceFeeds(): Promise<PriceFeed[]> {
  const response = await axios.get<PriceFeed[]>(
    "https://benchmarks.pyth.network/v1/price_feeds",
  );
  return response.data;
}

export function isValidPriceFeed(feed: PriceFeed): boolean {
  return !!(feed.id && feed.market_hours && feed.attributes?.display_symbol);
}

export function updateMetricsForFeed(
  metrics: PricePusherMetrics,
  feed: PriceFeed,
  logger: Logger,
): void {
  const { id, market_hours, attributes } = feed;

  logger.debug(
    {
      id,
      display_symbol: attributes.display_symbol,
      is_open: market_hours.is_open,
      next_open: market_hours.next_open,
      next_close: market_hours.next_close,
    },
    "Updating market hours metrics",
  );

  metrics.updateMarketHours(
    id,
    attributes.display_symbol,
    market_hours.is_open,
    market_hours.next_open,
    market_hours.next_close,
  );
}

export async function updateAllMarketHours(
  metrics: PricePusherMetrics,
  logger: Logger,
  configuredPriceIds: string[],
): Promise<void> {
  try {
    const priceFeeds = await fetchPriceFeeds();
    logger.debug(
      `Fetched ${priceFeeds.length} price feeds for market hours update`,
    );

    // Filter feeds to only those in the config
    const configuredFeeds = priceFeeds.filter((feed) =>
      configuredPriceIds.includes(feed.id),
    );
    logger.debug(
      `Found ${configuredFeeds.length} configured feeds out of ${priceFeeds.length} total feeds`,
    );

    for (const feed of configuredFeeds) {
      try {
        if (!isValidPriceFeed(feed)) {
          logger.warn({ feed }, "Skipping feed due to missing required fields");
          continue;
        }
        updateMetricsForFeed(metrics, feed, logger);
      } catch (feedError) {
        logger.error({ feed, error: feedError }, "Error processing feed");
        continue;
      }
    }
  } catch (error) {
    logger.error({ error }, "Failed to fetch market hours");
  }
}

// Initialization function
export function initMarketHoursUpdates(
  metrics: PricePusherMetrics,
  logger: Logger,
  configuredPriceIds: string[],
  intervalMs: number = 60000,
): () => void {
  logger.info("Starting market hours updates");

  // Initial update
  updateAllMarketHours(metrics, logger, configuredPriceIds);

  // Schedule regular updates
  const interval = setInterval(
    () => updateAllMarketHours(metrics, logger, configuredPriceIds),
    intervalMs,
  );

  // Return cleanup function
  return () => clearInterval(interval);
}
