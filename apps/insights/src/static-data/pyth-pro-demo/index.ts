import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import type { Nullish } from "@pythnetwork/shared-lib/types";
import { isNumber } from "@pythnetwork/shared-lib/util";

import type {
  AllAllowedSymbols,
  AllDataSourcesType,
  AllowedEquitySymbolsType,
  DataSourcesHistoricalType,
  PriceData,
} from "../../schemas/pyth/pyth-pro-demo-schema";
import { appendHistoricalSymbolSuffix } from "../../schemas/pyth/pyth-pro-demo-schema";
import { isHistoricalSymbol } from "../../util/pyth-pro-demo";

// in a next.js app, all paths must be resolved from the nearest package.json file,
// which ends up being the root of this server project
const dbPath = path.join(
  process.cwd(),
  "src",
  "static-data",
  "pyth-pro-demo",
  "historical-data.db",
);

const db = new DatabaseSync(dbPath, { open: true, readOnly: true });

const queryForDataStatement = db.prepare(`SELECT * FROM NasdaqAndPythData napd
WHERE napd.timestamp >= ? AND napd.source = ?
ORDER BY napd.timestamp asc
LIMIT ?;`);

type FetchHistoricalDataOpts = {
  datasource: DataSourcesHistoricalType;
  limit: number;
  startAt: number;
  symbol: AllowedEquitySymbolsType;
};

type DatabaseResult = {
  exponent: number;
  price: Nullish<number>;
  source: AllDataSourcesType;
  symbol: AllAllowedSymbols;
  timestamp: number;
};

/**
 * queries historical data out of the prepared SQLite database
 */
export function fetchHistoricalDataForPythFeedsDemo({
  datasource,
  limit,
  startAt,
  symbol,
}: FetchHistoricalDataOpts): PriceData[] {
  const symbolWithSuffix = appendHistoricalSymbolSuffix(symbol);
  const out: PriceData[] = [];

  if (!isHistoricalSymbol(symbolWithSuffix)) {
    return out;
  }

  const resultsIterator = queryForDataStatement.iterate(
    startAt,
    datasource,
    limit,
  );

  for (const result of resultsIterator) {
    const typedResult = result as DatabaseResult;

    if (!isNumber(typedResult.price)) continue;

    out.push({
      price: typedResult.price * Math.pow(10, typedResult.exponent),
      timestamp: typedResult.timestamp,
    });
  }

  return out;
}
