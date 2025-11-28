import { z } from "zod";

const BINANCE = "binance";
const BYBIT = "bybit";
const COINBASE = "coinbase";
const INFOWAY = "infoway_io";
const OKX = "okx";
const PRIME_API = "prime_api";
const PYTH = "pyth";
const PYTH_PRO = "pyth_pro";
const TWELVE_DATA = "twelve_data";

export const ALL_DATA_SOURCES = z.enum([
  BINANCE,
  BYBIT,
  COINBASE,
  INFOWAY,
  OKX,
  PRIME_API,
  PYTH,
  PYTH_PRO,
  TWELVE_DATA,
]);
export type AllDataSourcesType = z.infer<typeof ALL_DATA_SOURCES>;

export const DATA_SOURCES_REQUIRING_API_TOKENS = z.enum([
  ALL_DATA_SOURCES.Enum.infoway_io,
  ALL_DATA_SOURCES.Enum.prime_api,
  ALL_DATA_SOURCES.Enum.pyth_pro,
  ALL_DATA_SOURCES.Enum.twelve_data,
]);
export type DataSourcesRequiringApiTokens = z.infer<
  typeof DATA_SOURCES_REQUIRING_API_TOKENS
>;

export const DATA_SOURCES_CRYPTO = z.enum([
  BINANCE,
  BYBIT,
  COINBASE,
  OKX,
  PYTH,
  PYTH_PRO,
]);
export type DataSourcesCryptoType = z.infer<typeof DATA_SOURCES_CRYPTO>;

export const DATA_SOURCES_EQUITY = z.enum([
  PYTH,
  PYTH_PRO,
  TWELVE_DATA,
  INFOWAY,
]);
export type DataSourcesEquityType = z.infer<typeof DATA_SOURCES_EQUITY>;

export const DATA_SOURCES_FOREX = z.enum([
  PYTH,
  PYTH_PRO,
  PRIME_API,
  TWELVE_DATA,
]);
export type DataSourcesForexType = z.infer<typeof DATA_SOURCES_FOREX>;

export const DATA_SOURCES_FUTURES = z.enum([PYTH, PYTH_PRO]);
export type DataSourcesFuturesType = z.infer<typeof DATA_SOURCES_FUTURES>;

export const DATA_SOURCES_TREASURY = z.enum([PYTH, PYTH_PRO]);
export type DataSourcesTreasuryType = z.infer<typeof DATA_SOURCES_TREASURY>;

export const PriceDataSchema = z.object({
  price: z.number(),
  timestamp: z.number(),
});
export type PriceData = z.infer<typeof PriceDataSchema>;

export const CurrentPriceMetricsSchema = z.object({
  change: z.number().nullable().optional(),
  changePercent: z.number().nullable().optional(),
  price: z.number().nullable().optional(),
  timestamp: z.number(),
});
export type CurrentPriceMetrics = z.infer<typeof CurrentPriceMetricsSchema>;

export const ALLOWED_FUTURE_SYMBOLS = z.enum(["ESZ2025"]);
export type AllowedFutureSymbolsType = z.infer<typeof ALLOWED_FUTURE_SYMBOLS>;

export const ALLOWED_CRYPTO_SYMBOLS = z.enum(["BTCUSDT", "ETHUSDT", "SOLUSDT"]);
export type AllowedCryptoSymbolsType = z.infer<typeof ALLOWED_CRYPTO_SYMBOLS>;

export const ALLOWED_EQUITY_SYMBOLS = z.enum(["AAPL", "NVDA", "TSLA", "SPY"]);
export type AllowedEquitySymbolsType = z.infer<typeof ALLOWED_EQUITY_SYMBOLS>;

export const ALLOWED_TREASURY_SYMBOLS = z.enum(["US10Y"]);
export type AllowedTreasurySymbolsType = z.infer<
  typeof ALLOWED_TREASURY_SYMBOLS
>;

export const ALLOWED_FOREX_SYMBOLS = z.enum(["EURUSD"]);
export type AllowedForexSymbolsType = z.infer<typeof ALLOWED_FOREX_SYMBOLS>;

export const NO_SELECTED_SYMBOL = z.enum(["no_symbol_selected"]);
export type NoSelectedSymbolType = z.infer<typeof NO_SELECTED_SYMBOL>;

export const ALL_ALLOWED_SYMBOLS = z.enum([
  ...NO_SELECTED_SYMBOL.options,
  ...ALLOWED_FOREX_SYMBOLS.options,
  ...ALLOWED_FUTURE_SYMBOLS.options,
  ...ALLOWED_CRYPTO_SYMBOLS.options,
  ...ALLOWED_EQUITY_SYMBOLS.options,
  ...ALLOWED_TREASURY_SYMBOLS.options,
]);
export type AllAllowedSymbols = z.infer<typeof ALL_ALLOWED_SYMBOLS>;

export const LatestMetricSchema = z.record(
  ALL_ALLOWED_SYMBOLS,
  CurrentPriceMetricsSchema.nullable().optional(),
);
export type LatestMetric = z.infer<typeof LatestMetricSchema>;

export const AllAndLatestDataStateSchema = z.object({
  latest: LatestMetricSchema.nullable().optional(),
});
export type AllAndLatestDataState = z.infer<typeof AllAndLatestDataStateSchema>;

export const ApiTokensSchema = z.object(
  // eslint-disable-next-line unicorn/no-array-reduce
  ALL_DATA_SOURCES.options.reduce(
    (prev, key) => ({
      ...prev,
      [key]: z.string().nullable(),
    }),
    {} as Record<AllDataSourcesType, z.ZodNullable<z.ZodString>>,
  ),
);

export type ApiTokensState = z.infer<typeof ApiTokensSchema>;

export const CurrentPricesStoreStateSchema = z.object({
  metrics: z.record(
    ALL_DATA_SOURCES,
    z.object({
      latest: z.nullable(LatestMetricSchema),
    }),
  ),
  selectedSource: ALL_ALLOWED_SYMBOLS.optional().nullable(),
});
export type CurrentPricesStoreState = z.infer<
  typeof CurrentPricesStoreStateSchema
>;
