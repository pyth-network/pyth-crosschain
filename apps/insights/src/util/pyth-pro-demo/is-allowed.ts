/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import type { Nullish } from "@pythnetwork/shared-lib/types";

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

export function isAllowedSymbol(
  symbol: Nullish<string>,
): symbol is AllAllowedSymbols {
  if (symbol === ALL_ALLOWED_SYMBOLS.Enum.no_symbol_selected) return false;

  for (const s of Object.values(ALL_ALLOWED_SYMBOLS.Values)) {
    if (s === symbol) return true;
  }

  return false;
}

export function isAllowedCryptoSymbol(
  symbol: Nullish<string>,
): symbol is AllowedCryptoSymbolsType {
  for (const s of Object.values(ALLOWED_CRYPTO_SYMBOLS.Values)) {
    if (s === symbol) return true;
  }

  return false;
}

export function isAllowedCryptoDataSource(
  dataSource: Nullish<string>,
): dataSource is DataSourcesCryptoType {
  for (const s of Object.values(DATA_SOURCES_CRYPTO.Values)) {
    if (s === dataSource) return true;
  }
  return false;
}

export function isAllowedEquitySymbol(
  symbol: Nullish<string>,
): symbol is AllowedEquitySymbolsType {
  for (const s of Object.values(ALLOWED_EQUITY_SYMBOLS.Values)) {
    if (s === symbol) return true;
  }
  return false;
}

export function isAllowedEquityDataSource(
  dataSource: Nullish<string>,
): dataSource is DataSourcesEquityType {
  for (const s of Object.values(DATA_SOURCES_EQUITY.Values)) {
    if (s === dataSource) return true;
  }
  return false;
}

export function isAllowedForexSymbol(
  symbol: Nullish<string>,
): symbol is AllowedForexSymbolsType {
  for (const s of Object.values(ALLOWED_FOREX_SYMBOLS.Values)) {
    if (s === symbol) return true;
  }
  return false;
}

export function isAllowedForexDataSource(
  dataSource: Nullish<string>,
): dataSource is DataSourcesForexType {
  for (const s of Object.values(DATA_SOURCES_FOREX.Values)) {
    if (s === dataSource) return true;
  }
  return false;
}

export function isAllowedFutureSymbol(
  symbol: Nullish<string>,
): symbol is AllowedFutureSymbolsType {
  for (const s of Object.values(ALLOWED_FUTURE_SYMBOLS.Values)) {
    if (s === symbol) return true;
  }

  return false;
}

export function isAllowedDataSource(
  dataSource: Nullish<AllDataSourcesType>,
): dataSource is AllDataSourcesType {
  for (const s of Object.values(ALL_DATA_SOURCES.Values)) {
    if (s === dataSource) return true;
  }

  return false;
}

export function datasourceRequiresApiToken(
  dataSource: AllDataSourcesType,
): dataSource is DataSourcesRequiringApiTokens {
  const ds = dataSource as DataSourcesRequiringApiTokens;
  for (const val of DATA_SOURCES_REQUIRING_API_TOKENS.options) {
    if (val === ds) return true;
  }

  return false;
}

export function isReplayDataSource(
  dataSource: Nullish<AllDataSourcesType>,
): dataSource is DataSourcesReplayType {
  for (const source of DATA_SOURCES_REPLAY.options) {
    if (source === dataSource) return true;
  }
  return false;
}

export function isReplaySymbol(
  symbol: Nullish<string>,
): symbol is AllowedReplaySymbolsType {
  for (const val of ALLOWED_REPLAY_SYMBOLS.options) {
    if (val === symbol) return true;
  }

  return false;
}
