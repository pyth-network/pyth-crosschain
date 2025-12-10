import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

import type { Nullish } from "@pythnetwork/shared-lib/types";
import { isNullOrUndefined, isNumber } from "@pythnetwork/shared-lib/util";
import sqlite from "sqlite3";

import type {
  AllAllowedSymbols,
  AllDataSourcesType,
  AllowedEquitySymbolsType,
  HistoricalDataResponseType,
  PriceDataWithSource,
} from "../../schemas/pyth/pyth-pro-demo-schema";
import { appendReplaySymbolSuffix } from "../../schemas/pyth/pyth-pro-demo-schema";
import { isReplayDataSource, isReplaySymbol } from "../../util/pyth-pro-demo";

const uncompressedDbPath = path.join(
  process.cwd(),
  "public",
  "db",
  "historical-demo-data.db",
);
const compressedDbPath = `${uncompressedDbPath}.gz`;
const compressedDb = fs.readFileSync(compressedDbPath);
const decompressedDb = zlib.gunzipSync(compressedDb);
fs.writeFileSync(uncompressedDbPath, decompressedDb);

type FetchHistoricalDataOpts = {
  datasource: AllDataSourcesType;
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

const thing = new sqlite.Database(uncompressedDbPath);
thing.exec();

/**
 * queries historical data out of the prepared SQLite database
 */
export function fetchHistoricalDataForPythFeedsDemo({
  datasource,
  startAt,
  symbol,
}: FetchHistoricalDataOpts): HistoricalDataResponseType {
  const symbolWithSuffix = appendReplaySymbolSuffix(symbol);
  const out: PriceDataWithSource[] = [];
  const allDatasourcesValid = isReplayDataSource(datasource);

  if (!isReplaySymbol(symbolWithSuffix) || !allDatasourcesValid) {
    return { data: out, hasNext: false };
  }

  const db = new DatabaseSync(uncompressedDbPath, {
    open: false,
    readOnly: true,
  });

  db.open();

  const queryForDataStatement = db.prepare(`SELECT * FROM HistoricalData d
WHERE d.timestamp >= ?
  AND d.symbol = ?
  AND d.source = ?
ORDER BY d.timestamp asc
LIMIT 1000;`);

  const lastTimestampStatement =
    db.prepare(`SELECT MAX(timestamp) as lastTimestamp FROM HistoricalData d
WHERE d.symbol = ?
  AND d.source = ?`);

  const resultsIterator = queryForDataStatement.iterate(
    startAt,
    symbol,
    datasource,
  );
  const { lastTimestamp } =
    lastTimestampStatement.get(symbol, datasource) ?? {};

  if (isNullOrUndefined(lastTimestamp)) return { data: [], hasNext: false };

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
      symbol,
    });
  }

  db.close();

  return {
    data: out,
    hasNext:
      out.length <= 0 ||
      (out.at(-1)?.timestamp ?? lastTimestamp) < lastTimestamp,
  };
}
