type PriceFields = {
  exponent?: number | null | undefined;
  price?: number | null | undefined;
  best_bid_price?: number | null | undefined;
  best_ask_price?: number | null | undefined;
  confidence?: number | null | undefined;
  ema_price?: number | null | undefined;
  ema_confidence?: number | null | undefined;
  funding_rate?: number | null | undefined;
};

type DisplayFields = {
  display_price?: number;
  display_bid?: number;
  display_ask?: number;
  display_confidence?: number;
  display_ema_price?: number;
  display_ema_confidence?: number;
  display_funding_rate?: number;
};

/** Raw field -> display field. All of them scale by the feed's exponent. */
const DISPLAY_FIELDS = [
  ["price", "display_price"],
  ["best_bid_price", "display_bid"],
  ["best_ask_price", "display_ask"],
  ["confidence", "display_confidence"],
  ["ema_price", "display_ema_price"],
  ["ema_confidence", "display_ema_confidence"],
  // Verified live: FundingRate.Binance.BTC/USDT has exponent -12 and
  // fundingRate 12140000, i.e. 1.214e-5 per funding interval.
  ["funding_rate", "display_funding_rate"],
] as const satisfies ReadonlyArray<
  readonly [keyof PriceFields, keyof DisplayFields]
>;

/**
 * Add pre-computed human-readable values to feed data.
 * Prevents the most common agent error: returning raw integers
 * (e.g. 9742350000) instead of human-readable prices ($97,423.50).
 *
 * Formula: display_x = x * 10^exponent
 */
export function addDisplayPrices<T extends PriceFields>(
  feed: T,
): T & DisplayFields {
  if (feed.exponent == null) {
    return { ...feed };
  }

  const factor = Math.pow(10, feed.exponent);
  const display: DisplayFields = {};
  for (const [raw, out] of DISPLAY_FIELDS) {
    const value = feed[raw];
    if (value != null) display[out] = value * factor;
  }
  return { ...feed, ...display };
}
