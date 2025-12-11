import path from "node:path";

import { DuckDBInstance } from "@duckdb/node-api";
import type { Nullish } from "@pythnetwork/shared-lib/types";
import { isNullOrUndefined, isNumber } from "@pythnetwork/shared-lib/util";

import type {
  AllAllowedSymbols,
  AllDataSourcesType,
  AllowedEquitySymbolsType,
  HistoricalDataResponseType,
  PriceDataWithSource,
} from "../schemas/pyth/pyth-pro-demo-schema";
import { appendReplaySymbolSuffix } from "../schemas/pyth/pyth-pro-demo-schema";
import { isReplayDataSource, isReplaySymbol } from "../util/pyth-pro-demo";

const uncompressedDbPath = path.join(
  process.cwd(),
  "public",
  "db",
  "historical-demo-data.db",
);

type FetchHistoricalDataOpts = {
  datasource: AllDataSourcesType;
  startAt: string;
  symbol: AllowedEquitySymbolsType;
};

type DatabaseResult = {
  ask: Nullish<number>;
  bid: Nullish<number>;
  /**
   * in a valid ISO-8061 format that can be given to the new Date() constructor
   */
  datetime: string;
  price: Nullish<number>;
  source: AllDataSourcesType;
  symbol: AllAllowedSymbols;
};

/**
 * queries historical data out of the prepared SQLite database
 */
export async function fetchHistoricalDataForPythFeedsDemo({
  datasource,
  startAt,
  symbol,
}: FetchHistoricalDataOpts): Promise<HistoricalDataResponseType> {
  const instance = await DuckDBInstance.fromCache(uncompressedDbPath, {
    threads: "4",
  });
  const db = await instance.connect();

  const symbolWithSuffix = appendReplaySymbolSuffix(symbol);
  const out: PriceDataWithSource[] = [];
  const allDatasourcesValid = isReplayDataSource(datasource);

  if (!isReplaySymbol(symbolWithSuffix) || !allDatasourcesValid) {
    return { data: out, hasNext: false };
  }

  const queryForDataStatement = await db.prepare(`SELECT * FROM HistoricalData d
WHERE d.datetime >= $datetime
  AND d.symbol = $symbol
  AND d.source = $source
ORDER BY d.timestamp asc
LIMIT 1000;`);

  const lastTimestampStatement =
    await db.prepare(`SELECT MAX(timestamp) as lastTimestamp FROM HistoricalData d
WHERE d.symbol = $symbol
  AND d.source = $source`);

  queryForDataStatement.bind({
    datetime: startAt,
    source: datasource,
    symbol,
  });

  lastTimestampStatement.bind({
    source: datasource,
    symbol,
  });

  const results = await queryForDataStatement.run();
  const resultsIterator = await results.getRowObjectsJS();

  const lastTimestampResults = await lastTimestampStatement.run();
  const lastTimestampRows = await lastTimestampResults.getRowObjectsJS();
  const lastTimestamp = lastTimestampRows[0]?.lastTimestamp ?? undefined;

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
      timestamp: new Date(typedResult.datetime).getTime(),
      source: typedResult.source,
      symbol,
    });
  }

  return {
    data: out,
    hasNext:
      out.length <= 0 ||
      (out.at(-1)?.timestamp ?? lastTimestamp) < lastTimestamp,
  };
}
