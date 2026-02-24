type PriceFields = {
  exponent?: number | null | undefined;
  price?: number | null | undefined;
  best_bid_price?: number | null | undefined;
  best_ask_price?: number | null | undefined;
};

/**
 * Add pre-computed human-readable prices to feed data.
 * Prevents the most common agent error: returning raw integers
 * (e.g. 9742350000) instead of human-readable prices ($97,423.50).
 *
 * Formula: display_price = price * 10^exponent
 */
export function addDisplayPrices<T extends PriceFields>(
  feed: T,
): T & { display_price?: number; display_bid?: number; display_ask?: number } {
  const factor = Math.pow(10, feed.exponent ?? 0);

  return {
    ...feed,
    ...(feed.price != null && { display_price: feed.price * factor }),
    ...(feed.best_bid_price != null && {
      display_bid: feed.best_bid_price * factor,
    }),
    ...(feed.best_ask_price != null && {
      display_ask: feed.best_ask_price * factor,
    }),
  };
}
