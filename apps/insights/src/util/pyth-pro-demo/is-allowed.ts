import type { Nullish } from "@pythnetwork/shared-lib/types";
import { isNullOrUndefined } from "@pythnetwork/shared-lib/util";

import type {
  AllAllowedSymbols,
  AllDataSourcesType,
  AllowedCryptoSymbolsType,
  AllowedEquitySymbolsType,
  AllowedForexSymbolsType,
  AllowedFutureSymbolsType,
  AllowedReplaySymbolsType,
  DataSourcesCryptoType,
  DataSourcesEquityType,
  DataSourcesForexType,
  DataSourcesReplayType,
  DataSourcesRequiringApiTokens,
} from "../../schemas/pyth/pyth-pro-demo-schema";
import {
  ALL_ALLOWED_SYMBOLS,
  ALL_DATA_SOURCES,
  ALLOWED_CRYPTO_SYMBOLS,
  ALLOWED_EQUITY_SYMBOLS,
  ALLOWED_FOREX_SYMBOLS,
  ALLOWED_FUTURE_SYMBOLS,
  ALLOWED_REPLAY_SYMBOLS,
  DATA_SOURCES_CRYPTO,
  DATA_SOURCES_EQUITY,
  DATA_SOURCES_FOREX,
  DATA_SOURCES_REPLAY,
  DATA_SOURCES_REQUIRING_API_TOKENS,
} from "../../schemas/pyth/pyth-pro-demo-schema";

/**
 * this function is required to prevent needing to add
 * ts-expect-error suppression everywhere a typed enum array
 * is doing an Array.prototype.includes check on a nullish string.
 */
function schemaEnumIncludes(thing: Nullish<string>, enumOpts: string[]) {
  if (isNullOrUndefined(thing)) return false;

  return enumOpts.includes(thing);
}

export function isAllowedSymbol(
  symbol: Nullish<string>,
): symbol is AllAllowedSymbols {
  return (
    symbol !== ALL_ALLOWED_SYMBOLS.Enum.no_symbol_selected &&
    schemaEnumIncludes(symbol, ALL_ALLOWED_SYMBOLS.options)
  );
}

export function isAllowedCryptoSymbol(
  symbol: Nullish<string>,
): symbol is AllowedCryptoSymbolsType {
  return schemaEnumIncludes(symbol, ALLOWED_CRYPTO_SYMBOLS.options);
}

export function isAllowedCryptoDataSource(
  dataSource: Nullish<string>,
): dataSource is DataSourcesCryptoType {
  return schemaEnumIncludes(dataSource, DATA_SOURCES_CRYPTO.options);
}

export function isAllowedEquitySymbol(
  symbol: Nullish<string>,
): symbol is AllowedEquitySymbolsType {
  return schemaEnumIncludes(symbol, ALLOWED_EQUITY_SYMBOLS.options);
}

export function isAllowedEquityDataSource(
  dataSource: Nullish<string>,
): dataSource is DataSourcesEquityType {
  return schemaEnumIncludes(dataSource, DATA_SOURCES_EQUITY.options);
}

export function isAllowedForexSymbol(
  symbol: Nullish<string>,
): symbol is AllowedForexSymbolsType {
  return schemaEnumIncludes(symbol, ALLOWED_FOREX_SYMBOLS.options);
}

export function isAllowedForexDataSource(
  dataSource: Nullish<string>,
): dataSource is DataSourcesForexType {
  return schemaEnumIncludes(dataSource, DATA_SOURCES_FOREX.options);
}

export function isAllowedFutureSymbol(
  symbol: Nullish<string>,
): symbol is AllowedFutureSymbolsType {
  return schemaEnumIncludes(symbol, ALLOWED_FUTURE_SYMBOLS.options);
}

export function isAllowedDataSource(
  dataSource: Nullish<AllDataSourcesType>,
): dataSource is AllDataSourcesType {
  return schemaEnumIncludes(dataSource, ALL_DATA_SOURCES.options);
}

export function datasourceRequiresApiToken(
  dataSource: AllDataSourcesType,
): dataSource is DataSourcesRequiringApiTokens {
  return schemaEnumIncludes(
    dataSource,
    DATA_SOURCES_REQUIRING_API_TOKENS.options,
  );
}

export function isReplayDataSource(
  dataSource: Nullish<AllDataSourcesType>,
): dataSource is DataSourcesReplayType {
  return schemaEnumIncludes(dataSource, DATA_SOURCES_REPLAY.options);
}

export function isReplaySymbol(
  symbol: Nullish<string>,
): symbol is AllowedReplaySymbolsType {
  return schemaEnumIncludes(symbol, ALLOWED_REPLAY_SYMBOLS.options);
}
