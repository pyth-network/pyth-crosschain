/**
 * Model-facing Code Mode type definitions.
 * access_token is intentionally excluded — it is injected server-side for get_latest_price.
 */

export const CODE_MODE_TYPES = `
/** Pyth Pro Code Mode — write async code against codemode.* functions. */

type GetSymbolsInput = {
  query?: string;
  asset_type?: "crypto" | "fx" | "equity" | "metal" | "rates" | "commodity" | "funding-rate";
  limit?: number;
  offset?: number;
};

type GetHistoricalPriceInput = {
  price_feed_ids?: number[];
  symbols?: string[];
  timestamp: number;
  channel?: string;
};

type GetCandlestickDataInput = {
  symbol: string;
  resolution: "1" | "5" | "15" | "30" | "60" | "120" | "240" | "360" | "720" | "D" | "W" | "M";
  from: number;
  to: number;
  channel?: string;
};

/** access_token is automatically provided by the server — do not include it in your input */
type GetLatestPriceInput = {
  price_feed_ids?: number[];
  symbols?: string[];
  channel?: string;
  properties?: string[];
};

declare const codemode: {
  get_symbols: (input: GetSymbolsInput) => Promise<{ feeds: Array<{ pyth_lazer_id: number; symbol: string; asset_type: string; name: string; description: string; exponent: number }>; count: number; offset: number; total_available: number; has_more: boolean; next_offset: number | null }>;
  get_historical_price: (input: GetHistoricalPriceInput) => Promise<Array<{ price_feed_id: number; display_price?: number; price?: number; exponent?: number }>>;
  get_candlestick_data: (input: GetCandlestickDataInput) => Promise<{ t: number[]; o: number[]; h: number[]; l: number[]; c: number[]; v: number[]; s: string }>;
  get_latest_price: (input: GetLatestPriceInput) => Promise<Array<{ price_feed_id: number; display_price?: number; price?: number; exponent?: number }>>;
};
`.trim();
