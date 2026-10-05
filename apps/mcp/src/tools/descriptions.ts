import { ACCESS_TOKEN_URL, CHANNELS } from "../constants.js";

/** Shared description fragments: one wording per concept across tools. */

export const TOKEN_REQUIRED =
  "Requires the user's own Pyth Pro access token. If the user configured it in their MCP client, omit `access_token`; otherwise pass it as `access_token`, and if the tool reports it missing, ask the user for it.";

export const ACCESS_TOKEN_PARAM = `The user's own Pyth Pro access token. Omit it when the user configured one in their MCP client; a value here overrides that. Get one at ${ACCESS_TOKEN_URL}`;

export const FEED_IDS_PARAM =
  "Numeric feed IDs (pyth_lazer_id) from get_symbols";

export const SYMBOLS_PARAM =
  "Symbols from get_symbols (e.g. ['Crypto.BTC/USD', 'Equity.US.AAPL/USD']) or bare pairs like 'BTC/USD'";

export const CHANNEL_PARAM = `Override the default channel (update rate): ${CHANNELS.join(", ")}. Must not be faster than the feed's min_channel.`;

export const AUTO_TIMESTAMP =
  "Unix seconds, milliseconds or microseconds (auto-detected by magnitude)";

export const SYMBOL_INPUTS =
  "Symbols can be full names from get_symbols (e.g. 'Crypto.BTC/USD', 'Equity.US.AAPL/USD') or bare pairs like 'BTC/USD'. A bare pair resolves to the live spot feed when there is one, otherwise to the only remaining live match; `resolved_symbols` in the response shows what each input resolved to, and an ambiguous input returns an error listing the candidates.";

export const IDS_WIN =
  "If both price_feed_ids and symbols are provided, only price_feed_ids are used.";

export const MISSING_FEEDS =
  "Requested feeds that return no price are listed in `missing_feed_ids` (e.g. beta or coming_soon feeds, or a channel faster than the feed's min_channel).";

export const DISPLAY_FIELDS =
  "Prices are integers with an exponent field: human-readable price = price * 10^exponent. Pre-computed display_* fields (display_price, display_bid, display_ask, display_confidence, display_ema_price, display_ema_confidence, display_funding_rate) apply the exponent for you.";

export const HISTORY_START =
  "Historical data is available from April 2025 onward; do not request times before that.";

export const TIMESTAMP_REFERENCE =
  "Timestamp reference (Unix seconds):\n  2025-04-01 (earliest available) = 1743465600\n  2026-01-01 = 1767225600\n  2026-06-01 = 1780272000\nAlways double-check your timestamp math (year-boundary errors are common), or use convert_date_to_timestamp.";

/** Which price tool answers which question; each tool points at the others. */
export const PRICE_TOOL_CHOICE =
  "Price tools: get_latest_price for now, get_historical_price for one past instant, get_price_range for every update within up to 60 seconds, get_candlestick_data for OHLC bars over longer periods.";
