/* eslint-disable unicorn/no-array-reduce */
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import zlib from "node:zlib";

import type { Nullish } from "@pythnetwork/shared-lib/types";
import { isNumber } from "@pythnetwork/shared-lib/util";

import type {
  AllAllowedSymbols,
  AllDataSourcesType,
  AllowedEquitySymbolsType,
  PriceDataWithSource,
} from "../../schemas/pyth/pyth-pro-demo-schema";
import {
  ALLOWED_REPLAY_SYMBOLS,
  appendReplaySymbolSuffix,
  removeReplaySymbolSuffix,
} from "../../schemas/pyth/pyth-pro-demo-schema";
import { isReplayDataSource, isReplaySymbol } from "../../util/pyth-pro-demo";

// in a next.js app, all paths must be resolved from the nearest package.json file,
// which ends up being the root of this server project
const DB_PATHS_BY_SYMBOL = ALLOWED_REPLAY_SYMBOLS.options.reduce<
  Partial<Record<AllowedEquitySymbolsType, DatabaseSync>>
>((prev, opt) => {
  const symbol = removeReplaySymbolSuffix(opt);
  const uncompressedDbPath = path.join(
    process.cwd(),
    "public",
    "db",
    `${symbol.toLowerCase()}-historical-data.db`,
  );
  const compressedDbPath = `${uncompressedDbPath}.gz`;
  const compressedDb = fs.readFileSync(compressedDbPath);
  const decompressedDb = zlib.gunzipSync(compressedDb);
  fs.writeFileSync(uncompressedDbPath, decompressedDb);

  return {
    ...prev,
    [symbol]: new DatabaseSync(uncompressedDbPath, {
      open: true,
      readOnly: true,
    }),
  };
}, {});

type FetchHistoricalDataOpts = {
  datasources: AllDataSourcesType[];
  startAt: number;
  symbol: AllowedEquitySymbolsType;
};

type DatabaseResult = {
  ask: Nullish<number>;
  bid: Nullish<number>;
  price: Nullish<number>;
  source: AllDataSourcesType;
  symbol: AllAllowedSymbols;
  timestamp: number;
};

/**
 * queries historical data out of the prepared SQLite database
 */
export function fetchHistoricalDataForPythFeedsDemo({
  datasources,
  startAt,
  symbol,
}: FetchHistoricalDataOpts): PriceDataWithSource[] {
  const symbolWithSuffix = appendReplaySymbolSuffix(symbol);
  const out: PriceDataWithSource[] = [];
  const allDatasourcesValid = datasources.every((ds) => isReplayDataSource(ds));

  if (!isReplaySymbol(symbolWithSuffix) || !allDatasourcesValid) {
    return out;
  }

  const db = DB_PATHS_BY_SYMBOL[symbol];

  if (!db) return [];

  const sourcePlaceholders = datasources.map(() => "?").join(", ");

  // max 15 seconds worth of data on each query
  const maxTimestamp = startAt + 1000 * 15;

  const queryForDataStatement =
    db.prepare(`SELECT * FROM ${symbol.toUpperCase()} s
WHERE s.timestamp >= ? AND s.timestamp <= ? AND s.source in (${sourcePlaceholders})
ORDER BY s.timestamp asc;`);

  const resultsIterator = queryForDataStatement.iterate(
    startAt,
    maxTimestamp,
    ...datasources,
  );

  for (const result of resultsIterator) {
    const typedResult = result as DatabaseResult;

    if (!isNumber(typedResult.price)) continue;
    const ask =
      typedResult.source === "pyth_pro"
        ? Number.NaN
        : Number.parseFloat(String(typedResult.ask ?? ""));
    const bid =
      typedResult.source === "pyth_pro"
        ? Number.NaN
        : Number.parseFloat(String(typedResult.bid ?? ""));

    out.push({
      ask: Number.isNaN(ask) ? undefined : ask,
      bid: Number.isNaN(bid) ? undefined : bid,
      price: typedResult.price,
      timestamp: typedResult.timestamp,
      source: typedResult.source,
    });
  }

  return out;
}
