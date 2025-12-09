import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import type { Nullish } from "@pythnetwork/shared-lib/types";
import { isNumber } from "@pythnetwork/shared-lib/util";

import type {
  AllAllowedSymbols,
  AllDataSourcesType,
  AllowedEquitySymbolsType,
  PriceDataWithSource,
} from "../../schemas/pyth/pyth-pro-demo-schema";
import { appendReplaySymbolSuffix } from "../../schemas/pyth/pyth-pro-demo-schema";
import { isReplayDataSource, isReplaySymbol } from "../../util/pyth-pro-demo";

// in a next.js app, all paths must be resolved from the nearest package.json file,
// which ends up being the root of this server project
const dbPath = path.join(process.cwd(), "public", "db", "historical-data.db");

const db = new DatabaseSync(dbPath, { open: true, readOnly: true });

type FetchHistoricalDataOpts = {
  datasources: AllDataSourcesType[];
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
  datasources,
  limit,
  startAt,
  symbol,
}: FetchHistoricalDataOpts): PriceDataWithSource[] {
  const symbolWithSuffix = appendReplaySymbolSuffix(symbol);
  const out: PriceDataWithSource[] = [];
  const allDatasourcesValid = datasources.every((ds) => isReplayDataSource(ds));

  if (!isReplaySymbol(symbolWithSuffix) || !allDatasourcesValid) {
    return out;
  }

  const sourcePlaceholders = datasources.map(() => "?").join(", ");

  const queryForDataStatement = db.prepare(`SELECT * FROM NasdaqAndPythData napd
WHERE napd.timestamp >= ? AND napd.source in (${sourcePlaceholders})
ORDER BY napd.timestamp asc
LIMIT ?;`);

  const resultsIterator = queryForDataStatement.iterate(
    startAt,
    ...datasources,
    limit,
  );

  for (const result of resultsIterator) {
    const typedResult = result as DatabaseResult;

    if (!isNumber(typedResult.price)) continue;

    out.push({
      price: typedResult.price * Math.pow(10, typedResult.exponent),
      timestamp: typedResult.timestamp,
      source: typedResult.source,
    });
  }

  return out;
}
