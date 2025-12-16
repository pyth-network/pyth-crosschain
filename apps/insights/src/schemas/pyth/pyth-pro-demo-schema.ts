import { z } from "zod";

const BINANCE = "binance";
const BYBIT = "bybit";
const COINBASE = "coinbase";
const OKX = "okx";
const PYTH = "pyth";
const PYTH_PRO = "pyth_pro";
const NBBO = "nbbo";

export const ALL_DATA_SOURCES = z.enum([
  BINANCE,
  BYBIT,
  COINBASE,
  NBBO,
  OKX,
  PYTH,
  PYTH_PRO,
]);
export type AllDataSourcesType = z.infer<typeof ALL_DATA_SOURCES>;

export const DATA_SOURCES_REQUIRING_API_TOKENS = z.enum([
  ALL_DATA_SOURCES.Enum.pyth_pro,
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

export const DATA_SOURCES_EQUITY = z.enum([PYTH, PYTH_PRO]);
export type DataSourcesEquityType = z.infer<typeof DATA_SOURCES_EQUITY>;

export const DATA_SOURCES_HISTORICAL = z.enum([
  DATA_SOURCES_CRYPTO.Enum.pyth_pro,
  NBBO,
]);
export type DataSourcesHistoricalType = z.infer<typeof DATA_SOURCES_HISTORICAL>;

export const DATA_SOURCES_FOREX = z.enum([PYTH, PYTH_PRO]);
export type DataSourcesForexType = z.infer<typeof DATA_SOURCES_FOREX>;

export const DATA_SOURCES_FUTURES = z.enum([PYTH, PYTH_PRO]);
export type DataSourcesFuturesType = z.infer<typeof DATA_SOURCES_FUTURES>;

export const DATA_SOURCES_TREASURY = z.enum([PYTH, PYTH_PRO]);
export type DataSourcesTreasuryType = z.infer<typeof DATA_SOURCES_TREASURY>;

export const DATA_SOURCES_REPLAY = z.enum([NBBO, PYTH_PRO]);
export type DataSourcesReplayType = z.infer<typeof DATA_SOURCES_REPLAY>;

export const ALLOWED_FUTURE_SYMBOLS = z.enum(["ESZ2025"]);
export type AllowedFutureSymbolsType = z.infer<typeof ALLOWED_FUTURE_SYMBOLS>;

export const ALLOWED_CRYPTO_SYMBOLS = z.enum(["BTCUSDT", "ETHUSDT", "SOLUSDT"]);
export type AllowedCryptoSymbolsType = z.infer<typeof ALLOWED_CRYPTO_SYMBOLS>;

export const ALLOWED_EQUITY_SYMBOLS = z.enum([
  "AAPL",
  "AMZN",
  "HOOD",
  "NVDA",
  "TSLA",
  "SPY",
]);
export type AllowedEquitySymbolsType = z.infer<typeof ALLOWED_EQUITY_SYMBOLS>;

export const ALLOWED_TREASURY_SYMBOLS = z.enum(["US10Y"]);
export type AllowedTreasurySymbolsType = z.infer<
  typeof ALLOWED_TREASURY_SYMBOLS
>;

export const ALLOWED_FOREX_SYMBOLS = z.enum(["EURUSD"]);
export type AllowedForexSymbolsType = z.infer<typeof ALLOWED_FOREX_SYMBOLS>;

const REPLAY_SYMBOL_SEPARATOR = ":::replay";

export const ALLOWED_REPLAY_SYMBOLS = z.enum([
  `${ALLOWED_EQUITY_SYMBOLS.Enum.AMZN}${REPLAY_SYMBOL_SEPARATOR}`,
  `${ALLOWED_EQUITY_SYMBOLS.Enum.HOOD}${REPLAY_SYMBOL_SEPARATOR}`,
  `${ALLOWED_EQUITY_SYMBOLS.Enum.TSLA}${REPLAY_SYMBOL_SEPARATOR}`,
]);
export type AllowedReplaySymbolsType = z.infer<typeof ALLOWED_REPLAY_SYMBOLS>;

export const NO_SELECTED_SYMBOL = z.enum(["no_symbol_selected"]);
export type NoSelectedSymbolType = z.infer<typeof NO_SELECTED_SYMBOL>;

export const ALL_ALLOWED_SYMBOLS = z.enum([
  ...NO_SELECTED_SYMBOL.options,
  ...ALLOWED_FOREX_SYMBOLS.options,
  ...ALLOWED_FUTURE_SYMBOLS.options,
  ...ALLOWED_CRYPTO_SYMBOLS.options,
  ...ALLOWED_EQUITY_SYMBOLS.options,
  ...ALLOWED_TREASURY_SYMBOLS.options,
  ...ALLOWED_REPLAY_SYMBOLS.options,
]);
export type AllAllowedSymbols = z.infer<typeof ALL_ALLOWED_SYMBOLS>;

export const PriceDataSchema = z.object({
  ask: z.number().optional().nullable(),
  bid: z.number().optional().nullable(),
  price: z.number().optional().nullable(),
  timestamp: z.string().datetime(),
});
export type PriceData = z.infer<typeof PriceDataSchema>;

export const PriceDataSchemaWithSource = PriceDataSchema.extend({
  source: ALL_DATA_SOURCES,
  symbol: ALL_ALLOWED_SYMBOLS,
});
export type PriceDataWithSource = z.infer<typeof PriceDataSchemaWithSource>;

export const CurrentPriceMetricsSchema = z.object({
  ask: z.number().nullable().optional(),
  bid: z.number().nullable().optional(),
  change: z.number().nullable().optional(),
  changePercent: z.number().nullable().optional(),
  price: z.number().nullable().optional(),
  timestamp: z.string().datetime(),
});
export type CurrentPriceMetrics = z.infer<typeof CurrentPriceMetricsSchema>;

export function appendReplaySymbolSuffix(
  symbol: AllAllowedSymbols,
): `${typeof symbol}${typeof REPLAY_SYMBOL_SEPARATOR}` {
  if (symbol.endsWith(REPLAY_SYMBOL_SEPARATOR)) {
    return symbol as `${typeof symbol}${typeof REPLAY_SYMBOL_SEPARATOR}`;
  }
  return `${symbol}${REPLAY_SYMBOL_SEPARATOR}`;
}

export function removeReplaySymbolSuffix(
  symbolWithSuffix: AllAllowedSymbols,
): AllAllowedSymbols {
  return symbolWithSuffix.replace(
    REPLAY_SYMBOL_SEPARATOR,
    "",
  ) as AllAllowedSymbols;
}

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

export const HistoricalDataResponseSchema = z.object({
  data: z.array(PriceDataSchemaWithSource),
  hasNext: z.boolean(),
});
export type HistoricalDataResponseType = z.infer<
  typeof HistoricalDataResponseSchema
>;

export const ValidDateSchema = z.date();
export type ValidDateType = z.infer<typeof ValidDateSchema>;

export const GetPythFeedsDemoDataRequestSchema = z.strictObject({
  params: z.object({
    symbol: ALLOWED_EQUITY_SYMBOLS,
  }),
  searchParams: z.object({
    datasources: z.array(DATA_SOURCES_REPLAY),
    startAt: z
      .string()
      .datetime({ offset: true })
      .transform((val) => new Date(val)),
  }),
});
export type GetPythFeedsDemoDataRequestType = z.infer<
  typeof GetPythFeedsDemoDataRequestSchema
>;
